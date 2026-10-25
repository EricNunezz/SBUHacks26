"""Loads your own list of beginner repos into the `catalog` table. Does not generate any diagrams.

Run from backend/:  python scripts/import_my_catalog.py <file> [--dry-run]
  <file>  .txt (one URL per line), .csv (a `url` column) or .md (every github.com repo URL in the text)
  --dry-run  prints what would be imported and writes nothing

Each repo costs ONE GitHub API call (GET /repos/{owner}/{repo}, needs GITHUB_TOKEN), 5 at a time. The run stops early,
before any writes, if the rate limit is too low. Archived or missing repos are skipped and listed at the end.
Safe to re-run: rows are matched on (url, language); an existing diagram in `repos` sets catalog.repo_id.
"""
import csv
import os
import re
import sys
import threading
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import db  # noqa: E402
from mapping import normalize_github_url  # noqa: E402

GITHUB = "https://api.github.com"
WORKERS = 5
LABEL = "good first issue"
TOO_BIG_KB = 100 * 1024  # the API reports size in KB: ~100 MB
MIN_RATE_LEFT = 5  # stop when fewer calls than this remain
FIELDS = ("name", "owner", "repo", "label", "description", "repo_id")
# github.com/<first segment>/... that are not owners
NOT_OWNERS = {"orgs", "topics", "sponsors", "features", "settings", "marketplace", "about", "pricing", "collections", "search", "explore", "login", "enterprise"}

# owner/repo, with any extra path, query or fragment ignored
URL_RE = re.compile(r"https?://(?:www\.)?github\.com/([\w.-]+)/([\w.-]+)", re.IGNORECASE)


def parse_repo_urls(path: Path) -> tuple[list[str], list[str]]:
    """Returns (normalized unique repo URLs in file order, non-GitHub entries that were skipped)."""
    text = path.read_text(encoding="utf-8-sig")  # -sig: a Windows BOM would otherwise stick to the first URL
    entries: list[str] = []
    if path.suffix.lower() == ".csv":
        reader = csv.DictReader(text.splitlines())
        column = next((c for c in (reader.fieldnames or []) if c.strip().lower() == "url"), None)
        if column is None:
            sys.exit(f"{path.name}: no `url` column (found: {', '.join(reader.fieldnames or []) or 'none'})")
        entries = [(row.get(column) or "").strip() for row in reader]
    elif path.suffix.lower() == ".md":
        entries = [m.group(0) for m in URL_RE.finditer(text)]
    else:  # .txt and anything else: one URL per line
        entries = [line.strip() for line in text.splitlines() if line.strip()]

    urls, seen, skipped = [], set(), []
    for entry in entries:
        match = URL_RE.search(entry)
        owner, repo = (match.group(1), match.group(2)) if match else (None, None)
        if repo:
            repo = re.sub(r"\.git$", "", repo.rstrip("."), flags=re.IGNORECASE)
        parsed = normalize_github_url(f"https://github.com/{owner}/{repo}") if repo and owner.lower() not in NOT_OWNERS else None
        if not parsed:
            if entry:
                skipped.append(entry)
            continue
        url = parsed[2]
        if url.lower() not in seen:  # same repo, different case or path
            seen.add(url.lower())
            urls.append(url)
    return urls, skipped


def github_headers() -> dict:
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        sys.exit("GITHUB_TOKEN is not set (put it in backend/.env)")
    return {"Accept": "application/vnd.github+json", "Authorization": f"Bearer {token}", "X-GitHub-Api-Version": "2022-11-28"}


def check_rate_limit(client: httpx.Client, needed: int) -> None:
    """/rate_limit doesn't count against the limit. Exits before any work if there aren't enough calls left."""
    res = client.get(f"{GITHUB}/rate_limit")
    if res.status_code == 401:
        sys.exit("GitHub rejected GITHUB_TOKEN (401)")
    res.raise_for_status()
    core = res.json()["resources"]["core"]
    if core["remaining"] < needed + MIN_RATE_LEFT:
        sys.exit(f"GitHub rate limit too low: {core['remaining']} calls left, need about {needed}. Resets at epoch {core['reset']}.")
    print(f"GitHub rate limit: {core['remaining']}/{core['limit']} calls left")


def fetch_all(client: httpx.Client, urls: list[str]) -> tuple[dict, dict]:
    """One call per repo. Returns ({url: api json}, {url: reason it has no data})."""
    found, failed = {}, {}
    stop = threading.Event()

    def fetch(url: str) -> None:
        if stop.is_set():
            failed[url] = "not fetched (stopped early)"
            return
        owner, repo = url.removeprefix("https://github.com/").split("/")
        try:
            res = client.get(f"{GITHUB}/repos/{owner}/{repo}")
        except httpx.HTTPError as err:
            failed[url] = f"request failed: {err}"
            return
        if res.status_code == 404:
            failed[url] = "missing (404)"
        elif res.status_code in (403, 429) and res.headers.get("x-ratelimit-remaining") == "0":
            stop.set()
            failed[url] = "rate limited"
        elif res.status_code != 200:
            failed[url] = f"HTTP {res.status_code}"
        else:
            found[url] = res.json()
            if int(res.headers.get("x-ratelimit-remaining", MIN_RATE_LEFT + 1)) < MIN_RATE_LEFT:
                stop.set()

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        list(pool.map(fetch, urls))
    if stop.is_set():
        print("\nStopped early: GitHub rate limit is nearly used up. Re-run later; finished repos are not lost.")
    return found, failed


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry_run = "--dry-run" in sys.argv
    if len(args) != 1:
        sys.exit("usage: python scripts/import_my_catalog.py <file.txt|.csv|.md> [--dry-run]")
    path = Path(args[0])
    if not path.is_file():
        sys.exit(f"no such file: {path}")

    urls, non_github = parse_repo_urls(path)
    print(f"{path.name}: {len(urls)} unique GitHub repos, {len(non_github)} non-GitHub entries skipped")
    if not urls:
        return

    with httpx.Client(headers=github_headers(), timeout=30, follow_redirects=True) as client:
        check_rate_limit(client, len(urls))
        found, failed = fetch_all(client, urls)

    mapped = db.list_mapped_repo_urls()  # repos we already have a diagram for
    rows, archived, too_big = {}, [], []
    for url in urls:
        data = found.get(url)
        if data is None:
            continue
        if data.get("archived"):
            archived.append(url)
            continue
        owner, repo = url.removeprefix("https://github.com/").split("/")
        language = data.get("language") or "Other"
        rows[(url, language)] = {
            "name": repo,
            "url": url,
            "owner": owner,
            "repo": repo,
            "language": language,
            "label": LABEL,
            "description": data.get("description"),
            "repo_id": mapped.get(url),  # set only when a diagram exists
        }
        if (data.get("size") or 0) > TOO_BIG_KB:
            too_big.append((url, data["size"] / 1024))

    # Upsert by hand on (url, language): insert the new rows, update the ones that changed
    existing = {(r["url"], r["language"]): r for r in db.list_catalog()}
    existing_ids = db.list_catalog_keys()
    new_rows, updated = [], 0
    for key, row in rows.items():
        old = existing.get(key)
        if old is None:
            new_rows.append(row)
            continue
        changes = {f: row[f] for f in FIELDS if row[f] != old.get(f) and not (f == "repo_id" and row[f] is None)}
        if changes:  # never un-link a repo_id that is already set
            if not dry_run:
                db.update_catalog_row(existing_ids[key], changes)
            updated += 1
    if not dry_run:
        for start in range(0, len(new_rows), 100):
            db.insert_catalog_rows(new_rows[start : start + 100])

    if dry_run:
        print("\nWould import:")
        for (url, language), row in rows.items():
            status = "new" if (url, language) not in existing else "update/same"
            print(f"  [{language}] {url} ({status})")

    per_language = Counter(language for _, language in rows)
    already_mapped = sum(1 for r in rows.values() if r["repo_id"])
    print(f"\n{'DRY RUN, nothing written. ' if dry_run else ''}{len(rows)} rows: {len(new_rows)} inserted, {updated} updated")
    print(f"{already_mapped} already mapped, {len(too_big)} too big to map, {len(non_github) + len(archived) + len(failed)} skipped\n")
    print("Imported per language:")
    for language, count in sorted(per_language.items(), key=lambda kv: kv[0].casefold()):
        print(f"  {language:<28} {count}")

    if too_big:
        print("\nToo big to map (over ~100 MB, don't premap):")
        for url, mb in too_big:
            print(f"  {url}  ({mb:,.0f} MB)")
    if archived:
        print("\nSkipped, archived:")
        for url in archived:
            print(f"  {url}")
    if failed:
        print("\nSkipped, missing or not fetched:")
        for url, reason in failed.items():
            print(f"  {url}  ({reason})")
    if non_github:
        print("\nSkipped, not a GitHub repo URL:")
        for entry in non_github:
            print(f"  {entry}")


if __name__ == "__main__":
    main()

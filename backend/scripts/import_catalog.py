"""Imports the beginner-repo catalog from MunGell/awesome-for-beginners (CC0) into the `catalog` table.

Run from backend/:  python scripts/import_catalog.py [--dry-run]   (--dry-run prints the counts and writes nothing)
Safe to re-run: rows are matched on (url, language), new ones are inserted, changed ones updated.

data.json looks like:
  {"sponsors": [...], "technologies": {"<language>": "<slug>", ...},
   "repositories": [{"name", "link", "label", "technologies": ["<language>", ...], "description"}, ...]}
so one repository lists several languages, and we store one catalog row per (repo, language).
"""
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import db  # noqa: E402
from mapping import normalize_github_url  # noqa: E402

DATA_URL = "https://raw.githubusercontent.com/MunGell/awesome-for-beginners/main/data.json"
FIELDS = ("name", "owner", "repo", "label", "description", "repo_id")


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    data = httpx.get(DATA_URL, timeout=30, follow_redirects=True).raise_for_status().json()
    repositories = data["repositories"]
    print(f"data.json: {len(repositories)} repositories, {len(data['technologies'])} languages (keys: {', '.join(data)})")

    mapped = db.list_mapped_repo_urls()  # repos we already have a diagram for

    # Build one row per (repo, language), skipping anything that isn't a github.com/owner/repo URL
    rows, skipped = {}, 0
    for item in repositories:
        parsed = normalize_github_url(item.get("link", ""))
        if not parsed:
            skipped += 1
            print(f"  skip (not a GitHub repo URL): {item.get('link')}")
            continue
        owner, repo, url = parsed
        for language in item.get("technologies") or []:
            rows[(url, language)] = {
                "name": item["name"],
                "url": url,
                "owner": owner,
                "repo": repo,
                "language": language,
                "label": item.get("label"),
                "description": item.get("description"),
                "repo_id": mapped.get(url),  # set only when a diagram exists
            }

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
    for start in range(0, len(new_rows), 100):
        if not dry_run:
            db.insert_catalog_rows(new_rows[start : start + 100])

    per_language = Counter(language for _, language in rows)
    print(f"\n{'DRY RUN, nothing written. ' if dry_run else ''}{len(rows)} (repo, language) rows: {len(new_rows)} inserted, {updated} updated, {skipped} repos skipped")
    print(f"{sum(1 for r in rows.values() if r['repo_id'])} rows already mapped\n")
    for language, count in sorted(per_language.items(), key=lambda kv: kv[0].casefold()):
        print(f"{language:<28} {count}")


if __name__ == "__main__":
    main()

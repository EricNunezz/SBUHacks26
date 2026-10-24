"""Generates (or reuses) diagrams for a list of repos and marks them as featured, in list order.

Run from backend/:  python scripts/seed_featured.py [entries.json]
entries.json is a list of {"url": "...", "tags": ["..."]}; without it the FEATURED list below is used.
Repos already cached with a diagram are not regenerated. Generation runs one repo at a time with a pause.
"""
import asyncio
import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import db  # noqa: E402
from repo_analyzer import analyze_repo_with_gemini  # noqa: E402

FEATURED = [
    # {"url": "https://github.com/owner/repo", "tags": ["react", "frontend"]},
]
PAUSE_SECONDS = 15  # between generations, to stay under rate limits
WEAK_BELOW = 4  # nodes; fewer than this is flagged in the summary

# Same pattern as main.py (not imported: it would build the whole FastAPI app)
GITHUB_URL_REGEX = re.compile(r"^https://github\.com/([\w.-]+)/([\w.-]+?)(?:\.git)?/?$")


async def ensure_repo(owner: str, name: str, url: str) -> tuple[dict, bool]:
    """Returns (repo row, generated?). Mirrors POST /api/me/repos: cache first, placeholders get filled."""
    repo = await asyncio.to_thread(db.get_repo_by_url, url)
    if repo and repo.get("diagram"):
        return repo, False

    data = await analyze_repo_with_gemini(owner, name, url)
    diagram = {"nodes": data["nodes"], "edges": data["edges"]}
    if repo:
        repo = await asyncio.to_thread(db.update_repo_diagram, repo["id"], data["summary"], diagram, data["github_context"])
    else:
        repo = await asyncio.to_thread(db.save_repo, owner, name, url, data["summary"], diagram, data["github_context"])
    return repo, True


async def main() -> None:
    entries = json.loads(Path(sys.argv[1]).read_text()) if len(sys.argv) > 1 else FEATURED
    if not entries:
        print("No entries. Pass a JSON file or fill in FEATURED at the top of this script.")
        return

    results = []  # one dict per entry, in list order
    last_generated_at = None
    for entry in entries:
        match = GITHUB_URL_REGEX.match(entry["url"].strip())
        if not match:
            print(f"Skipping {entry['url']}: not a GitHub repo URL")
            results.append({"url": entry["url"], "status": "bad url"})
            continue
        owner, name = match.groups()
        url = f"https://github.com/{owner}/{name}"

        # Only generations need spacing; cached repos cost nothing
        cached = await asyncio.to_thread(db.get_repo_by_url, url)
        if not (cached and cached.get("diagram")) and last_generated_at is not None:
            wait = PAUSE_SECONDS - (time.monotonic() - last_generated_at)
            if wait > 0:
                print(f"  (pausing {wait:.0f}s)")
                await asyncio.sleep(wait)

        print(f"{owner}/{name} ...", flush=True)
        try:
            repo, generated = await ensure_repo(owner, name, url)
        except Exception as e:  # keep going: one bad repo shouldn't stop the batch
            detail = getattr(e, "detail", None) or str(e)
            print(f"  FAILED: {detail}")
            results.append({"url": url, "status": f"failed: {detail}"})
            last_generated_at = time.monotonic()
            continue
        if generated:
            last_generated_at = time.monotonic()
        print(f"  {'generated' if generated else 'cached'}")
        results.append({"url": url, "repo": repo, "status": "generated" if generated else "cached", "tags": entry.get("tags", [])})

    # Mark featured, in list order (position in the original list)
    for order, r in enumerate(results):
        if "repo" in r:
            await asyncio.to_thread(db.set_featured, r["repo"]["id"], order, r["tags"])

    print(f"\n{'#':>2}  {'repo':<40} {'nodes':>5} {'edges':>5}  status")
    for order, r in enumerate(results):
        if "repo" not in r:
            print(f"{order:>2}  {r['url']:<40} {'-':>5} {'-':>5}  {r['status']}")
            continue
        diagram = r["repo"].get("diagram") or {}
        nodes, edges = len(diagram.get("nodes", [])), len(diagram.get("edges", []))
        flag = "  <-- weak?" if nodes < WEAK_BELOW else ""
        print(f"{order:>2}  {r['repo']['owner'] + '/' + r['repo']['name']:<40} {nodes:>5} {edges:>5}  {r['status']}{flag}")
    print("\nRemove a bad one with: python scripts/unfeature.py <url>")


if __name__ == "__main__":
    asyncio.run(main())

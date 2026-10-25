"""Maps catalog repos ahead of time so beginners find them already drawn.

Run from backend/:  python scripts/premap_catalog.py <url> [<url> ...]   (or --file urls.txt, one url per line)
Each url must already be in the catalog (run import_catalog.py first). Repos that already have a diagram are
reused; the others are generated one at a time with a pause between, then linked to their catalog rows.
Prints node counts so weak diagrams are easy to spot.
"""
import asyncio
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import db  # noqa: E402
from mapping import MAX_MAPPABLE_FILES, get_or_create_repo, normalize_github_url  # noqa: E402

PAUSE_SECONDS = 15  # between generations, to stay under rate limits
WEAK_BELOW = 4  # nodes


def read_urls() -> list[str]:
    args = sys.argv[1:]
    if args[:1] == ["--file"] and len(args) == 2:
        return [line.strip() for line in Path(args[1]).read_text().splitlines() if line.strip() and not line.startswith("#")]
    return args


async def main() -> None:
    urls = read_urls()
    if not urls:
        sys.exit("Usage: python scripts/premap_catalog.py <url> [<url> ...]   or   --file urls.txt")

    results, last_generated_at = [], None
    for raw in urls:
        parsed = normalize_github_url(raw)
        if not parsed:
            results.append((raw, "-", "not a GitHub repo URL"))
            continue
        owner, name, url = parsed
        in_catalog = db.supabase.table("catalog").select("id").eq("url", url).limit(1).execute().data
        if not in_catalog:
            results.append((url, "-", "not in the catalog"))
            continue

        cached = db.get_repo_by_url(url)
        if not (cached and cached.get("diagram")) and last_generated_at is not None:
            wait = PAUSE_SECONDS - (time.monotonic() - last_generated_at)
            if wait > 0:
                print(f"  (pausing {wait:.0f}s)")
                await asyncio.sleep(wait)

        print(f"{owner}/{name} ...", flush=True)
        try:
            repo = await get_or_create_repo(owner, name, url, max_files=MAX_MAPPABLE_FILES)
        except Exception as e:  # keep going: one bad repo shouldn't stop the batch
            detail = getattr(e, "detail", None) or str(e)
            print(f"  FAILED: {detail}")
            results.append((url, "-", f"failed: {detail}"))
            last_generated_at = time.monotonic()
            continue
        generated = not (cached and cached.get("diagram"))
        if generated:
            last_generated_at = time.monotonic()
        db.set_catalog_repo(url, repo["id"])
        nodes = len((repo.get("diagram") or {}).get("nodes", []))
        results.append((url, nodes, "generated" if generated else "cached"))

    print(f"\n{'repo':<55} {'nodes':>5}  status")
    for url, nodes, status in results:
        flag = "  <-- weak?" if isinstance(nodes, int) and nodes < WEAK_BELOW else ""
        print(f"{url.removeprefix('https://github.com/'):<55} {nodes:>5}  {status}{flag}")


if __name__ == "__main__":
    asyncio.run(main())

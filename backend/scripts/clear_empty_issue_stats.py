"""Clear the cached stats of repos whose "issues" section is missing or lists no issues, so the next visit refetches.

Run from backend/:  python scripts/clear_empty_issue_stats.py [--dry-run]
(Cached stats are also refetched automatically when their "v" is older than STATS_VERSION in routers/stats.py.)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import db  # noqa: E402


def empty_issues(stats):
    issues = (stats or {}).get("issues")
    return not issues or not issues.get("good_first")


def main(dry_run):
    rows = db.supabase.table("repos").select("id, owner, name, stats").not_.is_("stats", "null").execute().data
    stale = [r for r in rows if empty_issues(r["stats"])]
    print(f"{len(stale)} of {len(rows)} repos with cached stats have an empty issues section")
    for r in stale:
        print(f"  {r['owner']}/{r['name']}")
        if not dry_run:
            db.supabase.table("repos").update({"stats": None, "stats_fetched_at": None}).eq("id", r["id"]).execute()
    print("dry run, nothing changed" if dry_run else "cleared")


if __name__ == "__main__":
    main("--dry-run" in sys.argv)

"""Removes a repo from the featured list (the repo and its cached diagram stay).

Run from backend/:  python scripts/unfeature.py https://github.com/owner/repo
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

import db  # noqa: E402

GITHUB_URL_REGEX = re.compile(r"^https://github\.com/([\w.-]+)/([\w.-]+?)(?:\.git)?/?$")


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("Usage: python scripts/unfeature.py <github url>")
    match = GITHUB_URL_REGEX.match(sys.argv[1].strip())
    if not match:
        sys.exit("Expected a URL like https://github.com/owner/repo")
    url = f"https://github.com/{match.group(1)}/{match.group(2)}"

    repo = db.get_repo_by_url(url)
    if not repo:
        sys.exit(f"No repo found for {url}")
    if not repo.get("is_featured"):
        sys.exit(f"{url} is not featured")
    db.unfeature_repo(repo["id"])
    print(f"Unfeatured {url}")


if __name__ == "__main__":
    main()

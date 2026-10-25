"""Shared by main.py and the scripts: URL normalising and the cache-aware "get or generate a repo" step."""
import asyncio
import re

import db
from repo_analyzer import analyze_repo_with_gemini

# Same pattern the app uses for POST /api/me/repos
GITHUB_URL_REGEX = re.compile(r"^https://github\.com/([\w.-]+)/([\w.-]+?)(?:\.git)?/?$")

# Catalog repos bigger than this (files left after filtering) are too big to map well
MAX_MAPPABLE_FILES = 3000


def normalize_github_url(url: str):
    """"https://github.com/Owner/Repo.git/" -> (owner, name, "https://github.com/Owner/Repo"), or None if it isn't a repo URL."""
    match = GITHUB_URL_REGEX.match((url or "").strip())
    if not match:
        return None
    owner, name = match.groups()
    return owner, name, f"https://github.com/{owner}/{name}"


async def get_or_create_repo(owner: str, name: str, url: str, max_files: int | None = None, before_generate=None) -> dict:
    """The repos row for this url. Uses the cache when it already has a diagram; otherwise generates one
    (raises HTTPException on failure, 422 if max_files is set and the repo is bigger).
    `before_generate` is an optional async callable passed to analyze_repo_with_gemini, so it runs only on a cache miss, after validation, right before Gemini."""
    repo = await asyncio.to_thread(db.get_repo_by_url, url)

    # Placeholder rows (diagram is null) get generated here too
    if repo and repo.get("diagram"):
        return repo

    analyzed = await analyze_repo_with_gemini(owner, name, url, max_files=max_files, before_generate=before_generate)
    diagram = {"nodes": analyzed["nodes"], "edges": analyzed["edges"]}

    if repo:
        return await asyncio.to_thread(db.update_repo_diagram, repo["id"], analyzed["summary"], diagram, analyzed["github_context"])
    try:
        return await asyncio.to_thread(db.save_repo, owner, name, url, analyzed["summary"], diagram, analyzed["github_context"])
    except Exception as e:
        # Someone saved the same url while we were generating: use theirs
        if "unique constraint" in str(e).lower() or "23505" in str(e):
            existing = await asyncio.to_thread(db.get_repo_by_url, url)
            if existing:
                return existing
        raise

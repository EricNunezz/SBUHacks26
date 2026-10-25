"""Shared by the chat and the file viewer: which files of a repo may be read, and fetching them from GitHub."""
import asyncio
from collections import OrderedDict
from typing import Optional
from urllib.parse import quote
from uuid import UUID

import httpx
from fastapi import HTTPException

import db
from repo_analyzer import GITHUB_HEADERS

FILE_MAX_BYTES = 200_000  # bigger files are skipped
FILE_TIMEOUT = 10
FILE_CACHE_SIZE = 100

# (repo_id, path) -> decoded file text; oldest entry is dropped past FILE_CACHE_SIZE
file_cache: "OrderedDict[tuple, str]" = OrderedDict()


class FileUnavailable(Exception):
    """`binary` tells the viewer to answer 415 instead of 404."""

    def __init__(self, binary: bool = False):
        self.binary = binary


async def get_allowed_repo(repo_id: UUID, user_id: str) -> dict:
    """The repo row, or 404 whether it's missing or just not in this user's list."""
    repo_id = str(repo_id)
    repo = await asyncio.to_thread(db.get_repo, repo_id) if await asyncio.to_thread(db.user_has_repo, user_id, repo_id) else None
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
    return repo


def allowed_file_path(file_path: Optional[str], nodes: list) -> Optional[str]:
    """The path only if it is one of this repo's diagram node files. Anything else is ignored (None).
    The shape checks are redundant with the allow-list but make the intent explicit."""
    if not file_path or file_path.startswith("/") or "\\" in file_path or "://" in file_path:
        return None
    if ".." in file_path.split("/"):
        return None
    allowed = {f for n in nodes for f in n.get("files", [])}
    return file_path if file_path in allowed else None


async def fetch_file_text(repo_id: str, repo: dict, path: str) -> str:
    """The file's full text from GitHub's raw host (uses GITHUB_TOKEN if set). Successes are cached.
    Raises FileUnavailable on a network error, a missing file, an oversized file, or binary content."""
    key = (repo_id, path)
    if key in file_cache:
        file_cache.move_to_end(key)
        return file_cache[key]

    url = f"https://raw.githubusercontent.com/{repo['owner']}/{repo['name']}/HEAD/{quote(path)}"
    try:
        async with httpx.AsyncClient(headers=GITHUB_HEADERS, timeout=FILE_TIMEOUT, follow_redirects=True) as http:
            async with http.stream("GET", url) as res:
                if res.status_code != 200:
                    raise FileUnavailable()
                raw = b""
                async for chunk in res.aiter_bytes():
                    raw += chunk
                    if len(raw) > FILE_MAX_BYTES:
                        raise FileUnavailable()
    except httpx.HTTPError:
        raise FileUnavailable()

    if b"\0" in raw[:8000]:
        raise FileUnavailable(binary=True)
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise FileUnavailable(binary=True)

    file_cache[key] = text
    if len(file_cache) > FILE_CACHE_SIZE:
        file_cache.popitem(last=False)
    return text

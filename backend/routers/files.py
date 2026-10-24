# backend/routers/files.py
import os
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException

from main import get_current_user_id
from repo_files import FileUnavailable, allowed_file_path, fetch_file_text, get_allowed_repo

router = APIRouter(tags=["files"])

VIEW_MAX_LINES = 2000

LANGUAGES = {
    ".py": "python", ".js": "javascript", ".jsx": "jsx", ".mjs": "javascript", ".cjs": "javascript",
    ".ts": "typescript", ".tsx": "tsx", ".go": "go", ".rs": "rust", ".java": "java", ".kt": "kotlin",
    ".rb": "ruby", ".php": "php", ".cs": "csharp", ".c": "c", ".h": "c", ".cc": "cpp", ".cpp": "cpp",
    ".hpp": "cpp", ".swift": "swift", ".scala": "scala", ".ex": "elixir", ".vue": "vue", ".svelte": "svelte",
    ".html": "html", ".css": "css", ".scss": "scss", ".json": "json", ".yml": "yaml", ".yaml": "yaml",
    ".toml": "toml", ".xml": "xml", ".md": "markdown", ".mdx": "markdown", ".sh": "bash", ".sql": "sql",
    ".txt": "plaintext",
}
FILENAMES = {"Dockerfile": "dockerfile", "Makefile": "makefile"}


def guess_language(path: str) -> str:
    name = path.rsplit("/", 1)[-1]
    return FILENAMES.get(name) or LANGUAGES.get(os.path.splitext(name)[1].lower(), "plaintext")


@router.get("/api/repos/{repo_id}/file")
async def view_file(repo_id: UUID, path: str, user_id: str = Depends(get_current_user_id)):
    """A file's code for the viewer. 404 if the path isn't one of this repo's node files or can't be fetched."""
    repo = await get_allowed_repo(repo_id, user_id)
    nodes = (repo.get("diagram") or {}).get("nodes", [])
    file_path = allowed_file_path(path, nodes)
    if not file_path:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        text = await fetch_file_text(str(repo_id), repo, file_path)
    except FileUnavailable as e:
        if e.binary:
            raise HTTPException(status_code=415, detail="Binary files can't be viewed")
        raise HTTPException(status_code=404, detail="Couldn't load that file")

    lines = text.splitlines()
    return {
        "path": file_path,
        "language": guess_language(file_path),
        "content": "\n".join(lines[:VIEW_MAX_LINES]),
        "truncated": len(lines) > VIEW_MAX_LINES,
        "line_count": len(lines),
    }

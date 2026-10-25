# backend/routers/file_analysis.py
import asyncio
import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from google.genai import types
from pydantic import BaseModel

import db
from main import get_current_user_id
from repo_analyzer import generate_with_retry
from repo_files import FileUnavailable, allowed_file_path, fetch_file_text, get_allowed_repo

log = logging.getLogger("uvicorn.error")

router = APIRouter(tags=["file-analysis"])

MAX_OUTPUT_TOKENS = 400
RETRY_DELAYS = (1,)  # one short retry on a busy primary, then the fallback
FILE_MAX_CHARS = 8_000


class FileAnalysisRequest(BaseModel):
    file_path: str


@router.post("/api/repos/{repo_id}/analyze-file")
async def analyze_file(repo_id: UUID, body: FileAnalysisRequest, user_id: str = Depends(get_current_user_id)):
    """A short plain-English description of one of the repo's node files. Saved per (repo, file) and reused."""
    repo = await get_allowed_repo(repo_id, user_id)
    file_path = allowed_file_path(body.file_path, (repo.get("diagram") or {}).get("nodes", []))
    if not file_path:
        raise HTTPException(status_code=404, detail="File not found")

    # A missing table just means no caching: the description is still generated
    try:
        saved = await asyncio.to_thread(db.get_file_description, str(repo_id), file_path)
    except Exception:
        log.warning("file_descriptions lookup failed (is the table created?)", exc_info=True)
        saved = None
    if saved:
        return {"file_path": file_path, "description": saved, "cached": True}

    try:
        text = await fetch_file_text(str(repo_id), repo, file_path)
    except FileUnavailable as e:
        if e.binary:
            raise HTTPException(status_code=415, detail="Binary files can't be summarized")
        raise HTTPException(status_code=404, detail="Couldn't load that file")

    prompt = (
        f"File: {file_path} (from the {repo['owner']}/{repo['name']} repository)\n\n"
        f"{text[:FILE_MAX_CHARS]}\n\n"
        "Explain in under 120 words what this file does and where it fits in the project, for a developer new to "
        "the codebase. Plain language, no preamble. Use markdown sparingly (a short list or `code` names are fine)."
    )
    config = types.GenerateContentConfig(
        temperature=0.3,
        max_output_tokens=MAX_OUTPUT_TOKENS,
        thinking_config=types.ThinkingConfig(thinking_level="MINIMAL"),
    )
    response, _ = await generate_with_retry(prompt, config, purpose="file-summary", retry_delays=RETRY_DELAYS)
    description = (response.text or "").strip()
    if not description:
        raise HTTPException(status_code=502, detail="The AI returned an empty summary. Try again.")

    try:
        await asyncio.to_thread(db.save_file_description, str(repo_id), file_path, description)
    except Exception:
        log.warning("couldn't save the description for %s (is the file_descriptions table created?)", file_path, exc_info=True)
    return {"file_path": file_path, "description": description, "cached": False}

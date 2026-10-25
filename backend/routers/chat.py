# backend/routers/chat.py
import asyncio
import logging
import re
import time
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from google.genai import types
from pydantic import BaseModel

import db
from main import get_current_user_id
from repo_analyzer import generate_with_retry
from repo_files import FileUnavailable, allowed_file_path, fetch_file_text, get_allowed_repo

log = logging.getLogger("uvicorn.error")

router = APIRouter(tags=["chat"])

MAX_HISTORY = 10
README_CHARS = 3000
MAX_OUTPUT_TOKENS = 800
CHAT_RETRY_DELAYS = (1,)  # one short retry on a busy primary, then the fallback
FILE_MAX_LINES = 150
FILE_MAX_CHARS = 8_000
NODE_REF = re.compile(r"\[\[([^\[\]]+)\]\]")


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    node_id: Optional[str] = None
    file_path: Optional[str] = None
    history: List[ChatMessage] = []


def one_line(text: str, limit: int = 160) -> str:
    text = " ".join(str(text or "").split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


async def fetch_file_snippet(repo_id: str, repo: dict, path: str) -> Optional[dict]:
    """First lines of a file with line numbers, or None when it can't be loaded."""
    try:
        text = await fetch_file_text(repo_id, repo, path)
    except FileUnavailable:
        return None

    lines = text.splitlines()
    numbered, used = [], 0
    for i, line in enumerate(lines[:FILE_MAX_LINES], 1):
        entry = f"{i}: {line}"
        if used + len(entry) + 1 > FILE_MAX_CHARS:
            break
        numbered.append(entry)
        used += len(entry) + 1
    return {"text": "\n".join(numbered), "truncated": len(numbered) < len(lines)}


def build_file_section(path: str, snippet: Optional[dict]) -> str:
    if snippet is None:
        return f"\n\nThe user is asking about the file {path}, but it could not be loaded. Don't guess at its contents."
    note = " The file is longer than this; only the beginning is shown." if snippet["truncated"] else ""
    return (
        f"\n\nThe user is asking about this file: {path}\n"
        f"Explain what the code does for a beginner, and reference specific line numbers when helpful. "
        f"Still use [[node_id]] for parts of the codebase.{note}\n"
        f"Contents (each line is prefixed with its line number):\n{snippet['text']}"
    )


def build_system_prompt(repo: dict, nodes: list, edges: list, node_id: Optional[str], file_section: str = "") -> str:
    """Compact context: summary, node list, edges, the attached node in full, and a short README excerpt.
    github_context can be {} or None on older rows."""
    readme = ((repo.get("github_context") or {}).get("readme") or "")[:README_CHARS]
    node_lines = "\n".join(
        f"- [[{n['id']}]] {n.get('label', '')} ({n.get('category', '')}): {one_line(n.get('summary'))}" for n in nodes
    )
    edge_lines = "\n".join(f"- {e['source']} -> {e['target']}: {e.get('label', '')}" for e in edges)

    prompt = (
        f"You are an expert software engineer helping the user understand the repository "
        f"'{repo.get('owner')}/{repo.get('name')}'. Answer from the material below and say so when it doesn't cover something. "
        f"Answer in under about 200 words unless the user asks for detail.\n\n"
        f"Project summary: {repo.get('summary') or '(none)'}\n\n"
        f"Diagram nodes. Refer to a part of the project by writing its id in double brackets, like [[id]], "
        f"and only use ids from this list:\n{node_lines or '(none)'}\n\n"
        f"Connections:\n{edge_lines or '(none)'}"
    )
    attached = next((n for n in nodes if n["id"] == node_id), None) if node_id else None
    if attached:
        points = "\n".join(f"  - {p}" for p in attached.get("key_points", []))
        files = ", ".join(attached.get("files", []))
        prompt += (
            f"\n\nThe user attached this node to their question:\n[[{attached['id']}]] {attached.get('label', '')} "
            f"({attached.get('category', '')})\nSummary: {attached.get('summary', '')}\n"
            f"Key points:\n{points or '  (none)'}\nFiles: {files or '(none)'}"
        )
    prompt += file_section
    if readme:
        prompt += f"\n\nREADME excerpt:\n{readme}"
    return prompt


def keep_known_node_refs(text: str, valid_ids: set) -> str:
    """[[id]] stays only for ids in this repo's diagram; unknown ones become plain text."""
    return NODE_REF.sub(lambda m: m.group(0) if m.group(1).strip() in valid_ids else m.group(1).strip(), text)


@router.get("/api/repos/{repo_id}/chat")
async def get_chat_thread(repo_id: UUID, user_id: str = Depends(get_current_user_id)):
    """The repo's whole thread (all nodes), oldest first."""
    await get_allowed_repo(repo_id, user_id)
    return await asyncio.to_thread(db.get_repo_messages, str(repo_id))


@router.post("/api/repos/{repo_id}/chat")
async def chat_with_repo(repo_id: UUID, body: ChatRequest, user_id: str = Depends(get_current_user_id)):
    started = time.perf_counter()
    repo = await get_allowed_repo(repo_id, user_id)
    diagram = repo.get("diagram") or {}
    nodes, edges = diagram.get("nodes", []), diagram.get("edges", [])

    # Gemini wants "user" / "model", must start with a user turn; the frontend sends "ai" for replies
    turns = [
        types.Content(role="user" if m.role == "user" else "model", parts=[types.Part(text=m.content)])
        for m in body.history[-MAX_HISTORY:]
    ]
    while turns and turns[0].role != "user":
        turns.pop(0)
    turns.append(types.Content(role="user", parts=[types.Part(text=body.message)]))

    file_path = allowed_file_path(body.file_path, nodes)
    snippet = await fetch_file_snippet(str(repo_id), repo, file_path) if file_path else None
    file_section = build_file_section(file_path, snippet) if file_path else ""
    system_prompt = build_system_prompt(repo, nodes, edges, body.node_id, file_section)
    prompt_chars = len(system_prompt) + sum(len(t.parts[0].text) for t in turns)
    config = types.GenerateContentConfig(
        system_instruction=system_prompt,
        temperature=0.4,
        max_output_tokens=MAX_OUTPUT_TOKENS,
        thinking_config=types.ThinkingConfig(thinking_level="MINIMAL"),  # chat answers need little reasoning
    )

    info = {}
    gemini_started = time.perf_counter()
    try:
        response, _ = await generate_with_retry(turns, config, info, purpose="chat", retry_delays=CHAT_RETRY_DELAYS)
    except HTTPException as e:
        log.warning("chat repo=%s FAILED status=%s retries=%s prompt_chars=%d total=%.2fs",
                    repo_id, e.status_code, info.get("retries"), prompt_chars, time.perf_counter() - started)
        raise
    gemini_secs = time.perf_counter() - gemini_started

    answer = keep_known_node_refs(response.text or "", {n["id"] for n in nodes})
    finish = response.candidates[0].finish_reason if response.candidates else None
    log.info(
        "chat repo=%s model=%s (%s) retries=%d prompt_chars=%d gemini=%.2fs total=%.2fs finish=%s",
        repo_id, info["model"], "fallback" if info["fallback"] else "primary", info["retries"],
        prompt_chars, gemini_secs, time.perf_counter() - started, getattr(finish, "name", finish),
    )
    if not answer.strip():
        raise HTTPException(status_code=502, detail="The AI returned an empty answer. Try again.")
    if file_path and snippet is None:
        answer += f"\n\n(I couldn't load `{file_path}`, so this answer doesn't use its code.)"

    # Save both sides of the exchange. The AI row's role must be "ai" (the chat_messages check constraint only
    # allows "user" or "ai"), and it carries the same node_id / file_path as the question it answers. A failed
    # save is logged with the database's error, but the user still gets their reply.
    for role, content, path in (("user", body.message, file_path), ("ai", answer, file_path)):
        try:
            await asyncio.to_thread(db.save_message, str(repo_id), body.node_id, role, content, path)
        except Exception:
            log.exception("chat repo=%s: could not save the %r message (node_id=%s)", repo_id, role, body.node_id)

    return {"content": answer}

# backend/routers/chat.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import db
from main import get_current_user_id  # or import your auth dependency
from google import genai
import os

router = APIRouter(tags=["chat"])
client = genai.Client()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    node_id: Optional[str] = None
    history: List[ChatMessage] = []

@router.post("/api/repos/{repo_id}/chat")
async def chat_with_repo(repo_id: str, body: ChatRequest, user_id: str = Depends(get_current_user_id)):
    # 1. Verify user has access to this repo
    if not db.user_has_repo(user_id, repo_id):
        raise HTTPException(status_code=404, detail="Repo not found")
    
    repo = db.get_repo(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    # 2. Build context and call Gemini
    github_context = repo.get("github_context", "")
    summary = repo.get("summary", "")
    
    # Format chat history for Gemini
    gemini_history = [{"role": m.role if m.role == "user" else "model", "parts": [m.content]} for m in body.history]
    
    chat_session = client.chats.create(
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        history=gemini_history
    )

    prompt = f"""
    You are an expert software engineer assistant helping the user understand the repository '{repo.get("owner")}/{repo.get("name")}'.
    Project Summary: {summary}
    
    GitHub Context (README/Manifests):
    {github_context[:6000]}
    
    User Query: {body.message}
    """
    if body.node_id:
        prompt += f"\nNote: The user specifically referenced or attached diagram node: [[{body.node_id}]]"

    response = chat_session.send_message(prompt)
    answer = response.text

    # 3. Save message pair to database (optional, depending on your db setup)
    try:
        db.save_message(repo_id, body.node_id, "user", body.message)
        db.save_message(repo_id, body.node_id, "assistant", answer)
    except Exception:
        pass

    return {"content": answer}
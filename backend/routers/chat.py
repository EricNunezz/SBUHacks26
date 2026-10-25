# backend/routers/chat.py
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import httpx
import os
import db
from google import genai

router = APIRouter(tags=["chat"])
client = genai.Client()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    node_id: Optional[str] = None
    history: List[ChatMessage] = []


async def fetch_node_code_snippets(repo: dict, node_id: str) -> str:
    """Finds the files associated with a specific diagram node and fetches their content from GitHub."""
    diagram = repo.get("diagram", {})
    nodes = diagram.get("nodes", [])
    
    # Find the target node matching the ID passed from the frontend
    target_node = next((n for n in nodes if n.get("id") == node_id), None)
    if not target_node or not target_node.get("files"):
        return ""

    owner = repo.get("owner")
    repo_name = repo.get("name")
    
    # We can fetch the default branch dynamically or fallback to main
    # Assuming standard GitHub raw content URL format
    file_paths = target_node["files"][:8] # Limit to max 8 files as per repo analyzer rules
    
    github_token = os.getenv("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json"}
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"

    snippets = []
    async with httpx.AsyncClient(headers=headers, timeout=10) as http_client:
        for path in file_paths:
            # Using raw.githubusercontent.com for fast file content retrieval
            url = f"https://raw.githubusercontent.com/{owner}/{repo_name}/main/{path}"
            try:
                res = await http_client.get(url)
                if res.status_code == 200:
                    snippets.append(f"--- File: {path} ---\n{res.text[:4000]}") # Truncate large files if necessary
            except Exception:
                pass

    return "\n\n".join(snippets)


@router.post("/api/repos/{repo_id}/chat")
async def chat_with_repo(repo_id: str, body: ChatRequest, user_id: str = Depends(db.get_current_user_id) if hasattr(db, "get_current_user_id") else None):
    # If your auth dependency lives in main, adjust the import accordingly.
    
    repo = db.get_repo(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    github_context = repo.get("github_context", "")
    summary = repo.get("summary", "")
    
    # If a node_id was attached/passed by the user, fetch code snippets for those specific files
    node_code_content = ""
    if body.node_id:
        node_code_content = await fetch_node_code_snippets(repo, body.node_id)

    # Format history for Gemini chat session
    gemini_history = [
        {"role": "user" if m.role == "user" else "model", "parts": [m.content]} 
        for m in body.history
    ]
    
    chat_session = client.chats.create(
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        history=gemini_history
    )

    # Build prompt incorporating repository summary, general context, and node-specific source code if present
    prompt = f"""
    You are an expert software engineer assistant helping the user analyze the repository '{repo.get("owner")}/{repo.get("name")}'.
    Project Summary: {summary}
    
    GitHub Context (README & Manifests):
    {github_context[:4000]}
    """

    if body.node_id and node_code_content:
        prompt += f"""
    --- Targeted Node Context (Node ID: {body.node_id}) ---
    The user is asking about or has attached this specific component/folder node. Here is the source code associated with it:
    {node_code_content}
    """

    prompt += f"\nUser Query: {body.message}"

    response = chat_session.send_message(prompt)
    answer = response.text

    # Save messages to database if your schema supports it
    try:
        db.save_message(repo_id, body.node_id, "user", body.message)
        db.save_message(repo_id, body.node_id, "assistant", answer)
    except Exception:
        pass

    return {"content": answer}
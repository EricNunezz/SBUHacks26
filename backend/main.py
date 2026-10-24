"""FastAPI entry point. Run with: uvicorn main:app --reload --port 8000"""
import asyncio
import re
from uuid import UUID

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Read variables from backend/.env into os.environ
load_dotenv()

import db  # noqa: E402
from repo_analyzer import analyze_repo_with_gemini  # <--- Imported from our new file

app = FastAPI(title="Repo Architecture Diagram API")

# Allow the Vite dev server (the frontend) to call this API from the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    """The frontend pings this to check that the backend is running."""
    return {"status": "ok"}


# --- Auth ---

def get_current_user_id(authorization: str | None = Header(default=None)) -> str:
    """Reads "Authorization: Bearer <token>" and asks Supabase who the token belongs to."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        response = db.supabase.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if not response or not response.user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return response.user.id


from routers.stats import router as stats_router; app.include_router(stats_router)  # noqa: E402 (needs get_current_user_id defined above)


# --- Per-user repos ---

class AddRepoBody(BaseModel):
    url: str


GITHUB_URL_REGEX = re.compile(r"^https://github\.com/([\w.-]+)/([\w.-]+?)(?:\.git)?/?$")


@app.get("/api/me/repos")
def get_my_repos(user_id: str = Depends(get_current_user_id)):
    return db.list_user_repos(user_id)


@app.post("/api/me/repos")
async def add_my_repo(body: AddRepoBody, user_id: str = Depends(get_current_user_id)):
    match = GITHUB_URL_REGEX.match(body.url.strip())
    if not match:
        raise HTTPException(status_code=400, detail="Expected a URL like https://github.com/owner/repo")
    
    owner, name = match.groups()
    url = f"https://github.com/{owner}/{name}"

    # Check if the repo is already analyzed and cached in your DB
    repo = await asyncio.to_thread(db.get_repo_by_url, url)

    # Placeholder rows (diagram is null) get generated here too
    if not repo or not repo.get("diagram"):
        analyzed_data = await analyze_repo_with_gemini(owner, name, url)
        diagram = {"nodes": analyzed_data["nodes"], "edges": analyzed_data["edges"]}

        if repo:
            repo = await asyncio.to_thread(db.update_repo_diagram, repo["id"], analyzed_data["summary"], diagram, analyzed_data["github_context"])
        else:
            repo = await asyncio.to_thread(db.save_repo, owner, name, url, analyzed_data["summary"], diagram, analyzed_data["github_context"])

    await asyncio.to_thread(db.link_repo_to_user, user_id, repo["id"])
    return repo


@app.get("/api/repos/{repo_id}")
def get_repo_diagram(repo_id: UUID, user_id: str = Depends(get_current_user_id)):
    """One repo's diagram. 404 whether the repo is missing or just not in this user's list."""
    repo_id = str(repo_id)
    repo = db.get_repo(repo_id) if db.user_has_repo(user_id, repo_id) else None
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    diagram = repo.get("diagram") or {}
    return {
        "id": repo["id"],
        "owner": repo["owner"],
        "name": repo["name"],
        "url": repo["url"],
        "summary": repo.get("summary"),
        "nodes": diagram.get("nodes", []),
        "edges": diagram.get("edges", []),
        "status": "ready" if repo.get("diagram") else "pending",
    }


@app.delete("/api/me/repos/{repo_id}", status_code=204)
def remove_my_repo(repo_id: str, user_id: str = Depends(get_current_user_id)):
    db.unlink_repo_from_user(user_id, repo_id)
    return Response(status_code=204)
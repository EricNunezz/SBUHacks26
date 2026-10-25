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
from mapping import MAX_MAPPABLE_FILES, get_or_create_repo, normalize_github_url  # noqa: E402


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


from routers.stats import router as stats_router; app.include_router(stats_router)  # noqa: E402
from routers.chat import router as chat_router; app.include_router(chat_router)  # noqa: E402
from routers.files import router as files_router; app.include_router(files_router)  # noqa: E402


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

    # Cache first; placeholder rows and missing repos get generated (shared with the catalog flow)
    repo = await get_or_create_repo(owner, name, url)

    await asyncio.to_thread(db.link_repo_to_user, user_id, repo["id"])
    return repo


def repo_response(repo: dict) -> dict:
    """The diagram payload shared by /api/repos/{id} and /api/explore/{id}."""
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


@app.get("/api/repos/{repo_id}")
def get_repo_diagram(repo_id: UUID, user_id: str = Depends(get_current_user_id)):
    """One repo's diagram. 404 whether the repo is missing or just not in this user's list."""
    repo_id = str(repo_id)
    repo = db.get_repo(repo_id) if db.user_has_repo(user_id, repo_id) else None
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
    return repo_response(repo)


# --- Public featured repos (no auth) ---

@app.get("/api/explore")
def explore():
    """Featured repos, in featured_order. The diagram itself is not sent, just its node count."""
    return [
        {
            "id": r["id"],
            "owner": r["owner"],
            "name": r["name"],
            "url": r["url"],
            "summary": r.get("summary"),
            "featured_tags": r.get("featured_tags") or [],
            "node_count": len((r.get("diagram") or {}).get("nodes", [])),
        }
        for r in db.list_featured_repos()
    ]


@app.get("/api/explore/{repo_id}")
def explore_repo(repo_id: UUID):
    """Same shape as /api/repos/{id}, readable by guests, but only for featured repos and repos linked from the catalog."""
    repo = db.get_explorable_repo(str(repo_id))
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")
    return repo_response(repo)


# --- Beginner catalog ---

def diagram_preview(diagram: dict) -> dict:
    """A light copy of a diagram for the catalog cards: node ids + categories and edge endpoints, nothing else."""
    return {
        "nodes": [{"id": n.get("id"), "category": n.get("category")} for n in diagram.get("nodes", [])],
        "edges": [{"source": e.get("source"), "target": e.get("target")} for e in diagram.get("edges", [])],
    }


# Shown first on the Explore page, in this order; every other language follows A to Z, "Other" last
POPULAR_LANGUAGES = [
    "JavaScript", "Python", "Java", "TypeScript", "C#", "C++", "PHP", "C", "Go", "Rust", "Ruby", "Swift", "Kotlin",
]


def language_order(language: str):
    popular = {name.casefold(): i for i, name in enumerate(POPULAR_LANGUAGES)}
    key = language.casefold()
    if key in popular:
        return (0, popular[key], "")
    return (2, 0, "") if key == "other" else (1, 0, key)


@app.get("/api/catalog")
def get_catalog():
    """Beginner-friendly repos grouped by language (popular languages first, then A to Z). Mapped entries (a diagram exists) come first, then by name."""
    groups: dict[str, list] = {}
    for row in db.list_catalog():
        diagram = (row.get("repos") or {}).get("diagram")
        mapped = bool(row.get("repo_id") and diagram)
        groups.setdefault(row["language"], []).append({
            "id": row["id"],
            "name": row["name"],
            "owner": row["owner"],
            "repo": row["repo"],
            "url": row["url"],
            "label": row.get("label"),
            "description": row.get("description"),
            "mapped": mapped,
            "repo_id": row["repo_id"] if mapped else None,
            "preview": diagram_preview(diagram) if mapped else None,
        })
    return [
        {"language": language, "entries": sorted(entries, key=lambda e: (not e["mapped"], e["name"].casefold()))}
        for language, entries in sorted(groups.items(), key=lambda kv: language_order(kv[0]))
    ]


@app.post("/api/catalog/{catalog_id}/map")
async def map_catalog_entry(catalog_id: UUID, user_id: str = Depends(get_current_user_id)):
    """Maps a catalog repo (cache aware), links it to the catalog and to the user, and returns its repo id."""
    entry = await asyncio.to_thread(db.get_catalog_entry, str(catalog_id))
    if not entry:
        raise HTTPException(status_code=404, detail="Catalog entry not found")
    parsed = normalize_github_url(entry["url"])
    if not parsed:
        raise HTTPException(status_code=422, detail="This entry isn't a GitHub repository")
    owner, name, url = parsed

    # Too-big repos are rejected before any AI work (the size check runs right after the file tree is fetched)
    repo = await get_or_create_repo(owner, name, url, max_files=MAX_MAPPABLE_FILES)
    await asyncio.to_thread(db.set_catalog_repo, entry["url"], repo["id"])
    await asyncio.to_thread(db.link_repo_to_user, user_id, repo["id"])
    return {"repo_id": repo["id"]}


@app.delete("/api/me/repos/{repo_id}", status_code=204)
def remove_my_repo(repo_id: str, user_id: str = Depends(get_current_user_id)):
    db.unlink_repo_from_user(user_id, repo_id)
    return Response(status_code=204)
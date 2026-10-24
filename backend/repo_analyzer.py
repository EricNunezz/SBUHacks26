# backend/repo_analyzer.py
import asyncio
import logging
import os
import re
from dotenv import load_dotenv
from typing import List, Literal
import httpx
from fastapi import HTTPException
from pydantic import BaseModel
from google import genai
from google.genai import types


load_dotenv()

# Initialize Gemini Client
client = genai.Client()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
GEMINI_FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-3.5-flash-lite")
RETRY_DELAYS = (2, 5, 10)  
RETRYABLE_CODES = (429, 500, 503)

log = logging.getLogger("uvicorn.error")

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_HEADERS = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}
if GITHUB_TOKEN:
    GITHUB_HEADERS["Authorization"] = f"Bearer {GITHUB_TOKEN}"


# --- Pydantic Schemas for Gemini Structured Output ---

Category = Literal["frontend", "backend", "database", "config", "external", "infra"]

class Node(BaseModel):
    id: str
    label: str
    category: Category
    summary: str
    key_points: List[str]
    files: List[str]

class Edge(BaseModel):
    id: str
    source: str
    target: str
    label: str

class RepoAnalysisResponse(BaseModel):
    summary: str
    nodes: List[Node]
    edges: List[Edge]


def github_error(res: httpx.Response) -> HTTPException:
    """Turns a failed GitHub response into a clean error. Never forwards 401: the frontend treats it as a logged-out user."""
    if res.status_code == 404:
        return HTTPException(status_code=404, detail="GitHub repository not found (it may be private).")
    if res.status_code == 429 or (res.status_code == 403 and res.headers.get("X-RateLimit-Remaining") == "0"):
        return HTTPException(status_code=429, detail="GitHub rate limit reached. Try again in a few minutes.")
    if res.status_code == 409:
        return HTTPException(status_code=422, detail="This repository is empty.")
    return HTTPException(status_code=502, detail=f"GitHub request failed ({res.status_code}).")


async def fetch_github_file_tree(owner: str, repo: str) -> List[str]:
    """Fetches the recursive file tree of a GitHub repository using httpx."""
    try:
        async with httpx.AsyncClient(headers=GITHUB_HEADERS, timeout=20) as http_client:
            repo_res = await http_client.get(f"https://api.github.com/repos/{owner}/{repo}")
            if repo_res.status_code != 200:
                raise github_error(repo_res)

            default_branch = repo_res.json().get("default_branch", "main")

            tree_res = await http_client.get(
                f"https://api.github.com/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1"
            )
            if tree_res.status_code != 200:
                raise github_error(tree_res)
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not reach GitHub. Try again.")

    paths = [item["path"] for item in tree_res.json().get("tree", []) if item["type"] == "blob"]
    return filter_paths(paths)


# Folders (at any depth) that never describe the app's own architecture
SKIP_DIRS = {
    ".git", ".changeset", ".github", "docs", "node_modules", "venv", ".venv", "__pycache__", "site-packages",
    "dist", "build", ".next", "coverage", "bower_components", "Pods",
    "vendor", "vendored", "third_party", "third-party", "extern",
    "generated", "__generated__", "gen",
    "fixtures", "__fixtures__", "__snapshots__", "__mocks__", "testdata", "test_data",
}
SKIP_FILES = {"package-lock.json", "pnpm-lock.yaml"}


def filter_paths(paths: List[str]) -> List[str]:
    """Drops noise (changelogs, docs, lockfiles, generated or vendored code) before the tree goes to Gemini."""
    has_src = any({"src", "lib"} & set(p.split("/")[:-1]) for p in paths)
    kept = []
    for path in paths:
        *dirs, name = path.split("/")
        upper = name.upper()
        if SKIP_DIRS & set(dirs) or (has_src and "examples" in dirs):
            continue
        if name in SKIP_FILES or upper.startswith("CHANGELOG") or name.endswith((".lock", ".snap")):
            continue
        if upper.endswith((".MD", ".MDX")) and not (not dirs and upper.startswith("README")):
            continue
        kept.append(path)
    return kept


def trim_words(text: str, limit: int = 5) -> str:
    words = str(text).split()
    return " ".join(words[:limit])


def slug(value: str, fallback: str) -> str:
    return re.sub(r"[^a-z0-9_-]+", "_", str(value).lower()).strip("_") or fallback


def unique(value: str, taken: set) -> str:
    candidate, n = value, 2
    while candidate in taken:
        candidate, n = f"{value}_{n}", n + 1
    taken.add(candidate)
    return candidate


def clean_diagram(data: dict) -> dict:
    """Makes ids slug-safe and unique, trims long labels, and drops edges that point at missing nodes."""
    node_ids, id_map, nodes = set(), {}, []
    for n in data["nodes"]:
        new_id = unique(slug(n["id"], "node"), node_ids)
        id_map.setdefault(n["id"], new_id)  # edges that use a duplicated id point at the first one
        nodes.append({**n, "id": new_id, "label": trim_words(n["label"])})
    if not nodes:
        raise HTTPException(status_code=502, detail="Gemini returned an empty diagram. Try again.")

    edge_ids, edges = set(), []
    for e in data["edges"]:
        source, target = id_map.get(e["source"]), id_map.get(e["target"])
        if not source or not target:
            continue
        edge_id = unique(slug(e["id"], f"{source}-{target}"), edge_ids)
        edges.append({**e, "id": edge_id, "source": source, "target": target, "label": trim_words(e["label"])})
    return {"summary": data["summary"], "nodes": nodes, "edges": edges}


async def analyze_repo_with_gemini(owner: str, repo_name: str, repo_url: str) -> dict:
    """Scans the repo via GitHub API and uses Gemini to generate the structural JSON."""
    file_paths = await fetch_github_file_tree(owner, repo_name)
    repo_slug = f"{owner}/{repo_name}"
    file_list = "\n".join(file_paths[:300])

    prompt = f"""
    Analyze the following GitHub repository file tree for '{repo_slug}' ({repo_url}).
    Infer its architecture, components, frontend/backend separation, databases, and configuration files based on the file paths provided.

    File Paths:
    {file_list}

    Map this architecture precisely into the requested JSON schema containing:
    - Overall summary of the project.
    - Nodes representing distinct structural blocks (frontend, backend, database, config, etc.) mapping to their respective files and key points.
    - Edges representing how these nodes connect.

    Rules:
    - Each node's "files" must be its most important SOURCE files: code a beginner would actually read to understand that part. At most 8 files per node. Never list release notes, changelogs, lockfiles, or docs.
    - Node labels are 2 to 4 words.
    - Edge labels are 2 to 4 words and a verb phrase, like "calls", "reads from", or "sends events to".
    """

    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=RepoAnalysisResponse,
        temperature=0.2,
    )

    async def generate(model):
        response = await client.aio.models.generate_content(model=model, contents=prompt, config=config)
        return response.parsed

    def is_temporary(e):
        return getattr(e, "code", None) in RETRYABLE_CODES

    parsed = None
    try:
        for delay in (0, *RETRY_DELAYS):
            await asyncio.sleep(delay)
            try:
                parsed = await generate(GEMINI_MODEL)
                log.info("Gemini analysis succeeded with %s", GEMINI_MODEL)
                break
            except Exception as e:
                if not is_temporary(e):
                    raise
                log.warning("Gemini %s failed temporarily (%s), retrying", GEMINI_MODEL, e)
        else:
            parsed = await generate(GEMINI_FALLBACK_MODEL)
            log.info("Gemini analysis succeeded with fallback %s", GEMINI_FALLBACK_MODEL)
    except Exception as e:
        log.error("Gemini analysis failed: %s", e)
        if is_temporary(e):
            raise HTTPException(status_code=503, detail="The AI is busy right now, please try again in a minute")
        raise HTTPException(status_code=502, detail=f"Gemini analysis failed: {e}")

    if parsed is None:
        raise HTTPException(status_code=502, detail="Gemini returned an unreadable response. Try again.")
    return clean_diagram(parsed.model_dump())

# backend/repo_analyzer.py
import os
from dotenv import load_dotenv
from typing import List
import httpx
from fastapi import HTTPException
from pydantic import BaseModel
from google import genai
from google.genai import types


load_dotenv()

# Initialize Gemini Client
client = genai.Client()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_HEADERS = {
    "Accept": "vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}
if GITHUB_TOKEN:
    GITHUB_HEADERS["Authorization"] = f"Bearer {GITHUB_TOKEN}"


# --- Pydantic Schemas for Gemini Structured Output ---

class Node(BaseModel):
    id: str
    label: str
    category: str
    summary: str
    key_points: List[str]
    files: List[str]

class Edge(BaseModel):
    id: str
    source: str
    target: str
    label: str

class RepoAnalysisResponse(BaseModel):
    id: str
    name: str
    url: str
    summary: str
    nodes: List[Node]
    edges: List[Edge]


async def fetch_github_file_tree(owner: str, repo: str) -> List[str]:
    """Fetches the recursive file tree of a GitHub repository using httpx."""
    async with httpx.AsyncClient() as http_client:
        repo_url = f"https://api.github.com/repos/{owner}/{repo}"
        repo_res = await http_client.get(repo_url, headers=GITHUB_HEADERS)
        
        if repo_res.status_code == 404:
            raise HTTPException(status_code=404, detail="GitHub repository not found.")
        elif repo_res.status_code != 200:
            raise HTTPException(status_code=repo_res.status_code, detail="Error communicating with GitHub API.")
            
        default_branch = repo_res.json().get("default_branch", "main")

        tree_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1"
        tree_res = await http_client.get(tree_url, headers=GITHUB_HEADERS)
        
        if tree_res.status_code != 200:
            raise HTTPException(status_code=tree_res.status_code, detail="Failed to fetch repository file tree.")
            
        tree_data = tree_res.json()
        
        file_paths = [
            item["path"] for item in tree_data.get("tree", [])
            if item["type"] == "blob" and not item["path"].startswith((".git/", "node_modules/", "venv/", "dist/"))
        ]
        return file_paths


async def analyze_repo_with_gemini(owner: str, repo_name: str, repo_url: str) -> dict:
    """Scans the repo via GitHub API and uses Gemini to generate the structural JSON."""
    file_paths = await fetch_github_file_tree(owner, repo_name)
    repo_slug = f"{owner}/{repo_name}"

    prompt = f"""
    Analyze the following GitHub repository file tree for '{repo_slug}' ({repo_url}).
    Infer its architecture, components, frontend/backend separation, databases, and configuration files based on the file paths provided.

    File Paths:
    {'\n'.join(file_paths[:300])}

    Map this architecture precisely into the requested JSON schema containing:
    - Overall summary of the project.
    - Nodes representing distinct structural blocks (frontend, backend, database, config, etc.) mapping to their respective files and key points.
    - Edges representing how these nodes connect.
    """

    try:
        response = client.models.generate_content(
            model='gemini-3.8-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=RepoAnalysisResponse,
                temperature=0.2,
            ),
        )
        return response.parsed.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini analysis failed: {str(e)}")
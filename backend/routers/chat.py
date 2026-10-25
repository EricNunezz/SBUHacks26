from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import httpx
import os
import db
from google import genai
from supabase import create_client, Client

router = APIRouter(tags=["chat"])
client = genai.Client()

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

class FileAnalysisRequest(BaseModel):
    file_path: str

@router.post("/api/repos/{repo_id}/analyze-file")
async def analyze_single_file(repo_id: str, body: FileAnalysisRequest, user_id: str = Depends(db.get_current_user_id) if hasattr(db, "get_current_user_id") else None):
    repo = db.get_repo(repo_id)
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found")

    owner = repo.get("owner")
    repo_name = repo.get("name")
    file_path = body.file_path

    # Treat github_context as a dictionary (with safe fallback)
    github_context = repo.get("github_context", {})
    if not isinstance(github_context, dict):
        github_context = {}

    # Extract branch dynamically from the dictionary, defaulting to 'main'
    branch = github_context.get("default_branch", "main")

    # 1. Fetch the file content from GitHub using the dynamic branch
    github_token = os.getenv("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json"}
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"

    url = f"https://raw.githubusercontent.com/{owner}/{repo_name}/{branch}/{file_path}"
    
    file_content = ""
    async with httpx.AsyncClient(headers=headers, timeout=10) as http_client:
        try:
            res = await http_client.get(url)
            if res.status_code == 200:
                file_content = res.text
            else:
                raise HTTPException(status_code=404, detail=f"File not found on GitHub: {file_path}")
        except httpx.RequestError:
            raise HTTPException(status_code=500, detail="Failed to connect to GitHub")

    # 2. Generate a description using Gemini API
    prompt = f"""
    Provide a clear and concise architectural overview and description of this source file (`{file_path}`) based on its contents:

    {file_content[:8000]}
    """

    try:
        response = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            contents=prompt
        )
        description = response.text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate description from Gemini: {str(e)}")

    # 3. Store the file name and description in Supabase "FileDescriptions" table
    try:
        db_response = supabase.table("FileDescriptions").insert({
            "name": file_path,          
            "description": description  
        }).execute()
    except Exception as e:
        print(f"Warning: Failed to save file description to Supabase: {str(e)}")

    return {
        "file_path": file_path,
        "description": description
    }
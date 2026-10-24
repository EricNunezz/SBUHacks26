"""FastAPI entry point. Run with: uvicorn main:app --reload --port 8000"""
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Read variables from backend/.env into os.environ
load_dotenv()

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

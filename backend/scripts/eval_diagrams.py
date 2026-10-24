"""Runs diagram generation for a list of repos and prints the results. Nothing is saved to Supabase.

Run from backend/:  python scripts/eval_diagrams.py [url ...]
"""
import asyncio
import logging
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

from fastapi import HTTPException  # noqa: E402

import repo_analyzer  # noqa: E402

REPOS = [
    "https://github.com/kishanrajput23/Jarvis-Desktop-Voice-Assistant.git",
    "https://github.com/jawwad9/Blogging-App-React.js.git",
    "https://github.com/hacetheworld/ecommerce-store.git",
    "https://github.com/barchart/aws-lambda-pdf-generator.git",
    "https://github.com/rtk-ai/rtk.git",
    "https://github.com/Nutlope/hallmark.git",
]
PAUSE_SECONDS = 10

# Same pattern as main.py (not imported: main.py needs Supabase credentials)
GITHUB_URL_REGEX = re.compile(r"^https://github\.com/([\w.-]+)/([\w.-]+?)(?:\.git)?/?$")


class ModelCapture(logging.Handler):
    """The analyzer logs which model succeeded; read it from there since it isn't returned."""

    def __init__(self):
        super().__init__()
        self.model = None

    def emit(self, record):
        match = re.search(r"succeeded with (fallback )?(\S+)", record.getMessage())
        if match:
            self.model = f"{match.group(2)} ({'fallback' if match.group(1) else 'primary'})"


async def run(url: str, capture: ModelCapture) -> None:
    match = GITHUB_URL_REGEX.match(url.strip())
    if not match:
        print(f"Skipping {url}: not a GitHub repo URL")
        return
    owner, name = match.groups()
    clean_url = f"https://github.com/{owner}/{name}"

    print(f"\n{'=' * 80}\n{owner}/{name}  ({clean_url})")
    capture.model = None
    start = time.perf_counter()
    try:
        result = await repo_analyzer.analyze_repo_with_gemini(owner, name, clean_url)
    except HTTPException as e:
        print(f"FAILED after {time.perf_counter() - start:.1f}s: {e.status_code} {e.detail}")
        return
    except Exception as e:
        print(f"FAILED after {time.perf_counter() - start:.1f}s: {e!r}")
        return

    model = result.get("model") or capture.model or "unknown"
    print(f"Model: {model} ({'fallback' if result.get('used_fallback') else 'primary'})   Time: {time.perf_counter() - start:.1f}s")
    print(f"\nSummary: {result['summary']}")
    print(f"\nNodes ({len(result['nodes'])}), edges ({len(result['edges'])}):")
    for node in result["nodes"]:
        print(f"  - {node['label']} [{node['category']}] ({len(node['files'])} files)")
        for file in node["files"]:
            print(f"      {file}")


async def main() -> None:
    capture = ModelCapture()
    logging.getLogger("uvicorn.error").addHandler(capture)
    urls = sys.argv[1:] or REPOS
    for i, url in enumerate(urls):
        if i:
            await asyncio.sleep(PAUSE_SECONDS)
        await run(url, capture)


if __name__ == "__main__":
    asyncio.run(main())

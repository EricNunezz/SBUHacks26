import asyncio
import os
from dotenv import load_dotenv
from main import analyze_repo_with_gemini

load_dotenv()

async def test_repo_scan():
    # Test repo details
    owner = "octocat"
    name = "Spoon-Knife"
    url = f"https://github.com/{owner}/{name}"
    
    print(f"Scanning and analyzing {url} with GitHub + Gemini...")
    try:
        # This runs your exact GitHub fetch & Gemini structured analysis code
        analysis_result = await analyze_repo_with_gemini(owner, name, url)
        
        print("\n--- Successfully Analyzed Repo! ---")
        print(f"Summary: {analysis_result.get('summary')}")
        print(f"Nodes found: {len(analysis_result.get('nodes', []))}")
        print(f"Edges found: {len(analysis_result.get('edges', []))}")
        
    except Exception as e:
        print(f"Error during test: {e}")

if __name__ == "__main__":
    asyncio.run(test_repo_scan())
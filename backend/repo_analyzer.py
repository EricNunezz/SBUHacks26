# backend/repo_analyzer.py
import asyncio
import logging
import os
import re
from dotenv import load_dotenv
from typing import Dict, List, Literal, Optional, Tuple
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
MIN_NODES_FOR_BIG_REPO = 4
BIG_REPO_SOURCE_FILES = 8

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


async def fetch_github_file_tree(owner: str, repo: str) -> Tuple[List[str], str, bool]:
    """Fetches the recursive file tree of a GitHub repository using httpx.
    Returns (filtered paths, default branch, whether GitHub truncated the tree)."""
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

    tree = tree_res.json()
    paths = [item["path"] for item in tree.get("tree", []) if item["type"] == "blob"]
    return filter_paths(paths), default_branch, bool(tree.get("truncated"))


# Folders (at any depth) that never describe the app's own architecture
SKIP_DIRS = {
    ".git", ".changeset", ".github", "docs", "node_modules", "venv", ".venv", "__pycache__", "site-packages",
    "dist", "build", ".next", "coverage", "bower_components", "Pods",
    "vendor", "vendored", "third_party", "third-party", "extern",
    "generated", "__generated__", "gen",
    "fixtures", "__fixtures__", "__snapshots__", "__mocks__", "testdata", "test_data",
}
SKIP_FILES = {"package-lock.json", "pnpm-lock.yaml"}


# Markdown and template files can be the substance of a repo (skills, prompts, themes, templates)
CONTENT_EXTS = (".md", ".mdx", ".txt", ".tmpl", ".j2", ".jinja", ".hbs", ".ejs", ".liquid", ".prompt")
FEW_SOURCE_FILES = 15  # fewer source files than this and content folders count as source
CONTENT_FOLDER_MIN = 5  # content files a folder needs to count as a dedicated content folder


def content_folder(dirs: List[str]) -> str:
    """Top-level folder a file lives in; dot folders like .claude/skills go one level deeper."""
    if not dirs:
        return ""
    return "/".join(dirs[:2]) if dirs[0].startswith(".") else dirs[0]


def content_folders(paths: List[str]) -> set:
    """Folders full of markdown/template files, but only for repos with few real source files."""
    if sum(is_source_path(p) for p in paths) >= FEW_SOURCE_FILES:
        return set()
    counts: Dict[str, int] = {}
    for path in paths:
        *dirs, name = path.split("/")
        folder = content_folder(dirs)
        if folder and not SKIP_DIRS & set(dirs) and name.lower().endswith(CONTENT_EXTS):
            counts[folder] = counts.get(folder, 0) + 1
    return {folder for folder, n in counts.items() if n >= CONTENT_FOLDER_MIN}


def filter_paths(paths: List[str]) -> List[str]:
    """Drops noise (changelogs, docs, lockfiles, generated or vendored code) before the tree goes to Gemini."""
    has_src = any({"src", "lib"} & set(p.split("/")[:-1]) for p in paths)
    content = content_folders(paths)
    kept = []
    for path in paths:
        *dirs, name = path.split("/")
        upper = name.upper()
        if SKIP_DIRS & set(dirs) or (has_src and "examples" in dirs):
            continue
        if name in SKIP_FILES or upper.startswith("CHANGELOG") or name.endswith((".lock", ".snap")):
            continue
        if upper.endswith((".MD", ".MDX")) and not (not dirs and upper.startswith("README")):
            if content_folder(dirs) not in content:
                continue
        kept.append(path)
    return kept


README_CAP = 8000
MANIFEST_CAP = 3000
MANIFEST_NAMES = [
    "package.json", "requirements.txt", "pyproject.toml", "go.mod", "Cargo.toml",
    "pom.xml", "Dockerfile", "docker-compose.yml",
]
ENTRY_FILE_COUNT = 15
ENTRY_FILE_LINES = 60
ENTRY_FILE_CAP = 4000
PROMPT_BUDGET = 60_000  # characters of repo content; the least important pieces are dropped to fit
MAX_TREE_PATHS = 300

SOURCE_EXTS = (
    ".py", ".js", ".jsx", ".ts", ".tsx", ".mjs", ".go", ".rs", ".java", ".kt", ".rb", ".php",
    ".cs", ".c", ".cc", ".cpp", ".h", ".hpp", ".swift", ".scala", ".ex", ".vue", ".svelte",
)
ENTRY_STEMS = {"main", "index", "app", "server", "cli", "__main__", "manage", "wsgi", "asgi"}


def is_source_path(path: str) -> bool:
    return path.endswith(SOURCE_EXTS) and not path.endswith(".d.ts") and not is_test_path(path)


def is_test_path(path: str) -> bool:
    lower = path.lower()
    parts = set(lower.split("/")[:-1])
    name = lower.rsplit("/", 1)[-1]
    return bool(
        {"test", "tests", "__tests__", "spec", "e2e"} & parts
        or ".test." in name or ".spec." in name or name.startswith("test_") or name.endswith("_test.go")
    )


def pick_entry_files(paths: List[str], limit: int = ENTRY_FILE_COUNT) -> List[str]:
    """Likely entry points or core files: main/index/app/server/cli names, or files directly under src/ or lib/ (or one package deep).
    Shallow, named entry points rank first."""
    ranked = []
    for path in paths:
        *dirs, name = path.split("/")
        if not name.endswith(SOURCE_EXTS) or name.endswith(".d.ts") or is_test_path(path):
            continue
        is_entry = name.split(".")[0].lower() in ENTRY_STEMS
        in_core_dir = 1 <= len(dirs) <= 2 and dirs[0] in ("src", "lib")  # src/x.py or src/pkg/x.py
        if is_entry or in_core_dir:
            ranked.append((not is_entry, len(dirs), path))
    return [path for *_, path in sorted(ranked)[:limit]]


async def fetch_text(http_client: httpx.AsyncClient, owner: str, repo: str, branch: str, path: str) -> Optional[str]:
    """One file from raw.githubusercontent.com (no API rate limit). None if it can't be read."""
    try:
        res = await http_client.get(f"https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}")
        return res.text if res.status_code == 200 else None
    except httpx.HTTPError:
        return None


async def fetch_repo_content(owner: str, repo: str, branch: str, paths: List[str]) -> dict:
    """README, root manifests and the head of likely entry files, fetched in parallel. Failed fetches are skipped."""
    root = set(paths)
    readme_path = next((p for p in paths if "/" not in p and p.upper().startswith("README")), None)
    manifest_paths = [n for n in MANIFEST_NAMES if n in root]
    entry_paths = pick_entry_files(paths)
    wanted = ([readme_path] if readme_path else []) + manifest_paths + entry_paths

    async with httpx.AsyncClient(headers=GITHUB_HEADERS, timeout=20) as http_client:
        texts = await asyncio.gather(*(fetch_text(http_client, owner, repo, branch, p) for p in wanted))
    fetched = {p: t for p, t in zip(wanted, texts) if t and t.strip()}

    def head(path: str) -> str:
        return "\n".join(fetched[path].splitlines()[:ENTRY_FILE_LINES])[:ENTRY_FILE_CAP]

    return {
        "readme": fetched[readme_path][:README_CAP] if readme_path in fetched else "",
        "manifests": {p: fetched[p][:MANIFEST_CAP] for p in manifest_paths if p in fetched},
        "entry_files": {p: head(p) for p in entry_paths if p in fetched},  # most important first
    }


def build_context_sections(content: dict) -> str:
    """Joins README, manifests and entry files, dropping the least important pieces until under the budget."""
    pieces = [(f"README ({len(content['readme'])} chars)", content["readme"])] if content["readme"] else []
    pieces += list(content["manifests"].items())
    pieces += list(content["entry_files"].items())

    def render(items):
        return "\n\n".join(f"--- {name} ---\n{text}" for name, text in items)

    while len(pieces) > 1 and len(render(pieces)) > PROMPT_BUDGET:
        pieces.pop()  # entry files go first (last-ranked first), then manifests, README stays longest
    text = render(pieces)
    return text[:PROMPT_BUDGET]


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
    """Makes ids slug-safe and unique, trims long labels, keeps each file in the first node that lists it,
    and drops edges that point at missing nodes."""
    node_ids, id_map, nodes, seen_files = set(), {}, [], set()
    for n in data["nodes"]:
        new_id = unique(slug(n["id"], "node"), node_ids)
        id_map.setdefault(n["id"], new_id)  # edges that use a duplicated id point at the first one
        files = [f for f in dict.fromkeys(n["files"]) if f not in seen_files]  # each file belongs to one node
        seen_files.update(files)
        nodes.append({**n, "id": new_id, "label": trim_words(n["label"]), "files": files})
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
    file_paths, branch, tree_truncated = await fetch_github_file_tree(owner, repo_name)
    repo_slug = f"{owner}/{repo_name}"
    file_list = "\n".join(file_paths[:MAX_TREE_PATHS])
    content = await fetch_repo_content(owner, repo_name, branch, file_paths)
    code_context = build_context_sections(content)

    tree_notes = []
    if tree_truncated:
        tree_notes.append("GitHub truncated this repository's file tree, so the list below is incomplete (this is a very large repo).")
    if len(file_paths) > MAX_TREE_PATHS:
        tree_notes.append(f"Only the first {MAX_TREE_PATHS} of {len(file_paths)} paths are listed.")
    tree_note = "\n    ".join(tree_notes)
    source_count = sum(is_source_path(p) for p in file_paths)

    prompt = f"""
    Analyze the following GitHub repository file tree for '{repo_slug}' ({repo_url}).
    Infer its architecture, components, frontend/backend separation, databases, and configuration files from the README, manifests and source excerpts below, and the file paths.

    {tree_note}
    File Paths:
    {file_list}

    Repository content (README, manifests, and the first lines of likely entry-point files):
    {code_context or "(none could be fetched)"}

    Map this architecture precisely into the requested JSON schema containing:
    - Overall summary of the project.
    - Nodes representing distinct structural blocks (frontend, backend, database, config, etc.) mapping to their respective files and key points.
    - Edges representing how these nodes connect.

    This repository has {source_count} source code files.

    Rules:
    - Use 5 to 10 nodes. Only go below 5 if the repo has fewer than about 8 source files.
    - Split large areas by responsibility instead of lumping them together. For example, a backend with auth, products and payments routes becomes separate nodes.
    - Every important external service, framework or engine named in the README, manifests or code (for example Stripe, Firebase, Puppeteer/Chromium, AWS Lambda, API Gateway, MongoDB, OpenAI) must be its own node with category "external", or "database" for databases, connected to the parts that use it.
    - Each file belongs to at most one node. Never repeat a file across nodes.
    - Edges show how requests and data actually flow at runtime, including fan-out and cross connections, not just a single chain.
    - Include a config node only if it is genuinely useful. Merge all build and config files into at most one config node.
    - Any technology mentioned in your summary must appear as a node or in a node's key points.
    - Base each node's summary and key points on the actual code and README above, not on guesses from file names. Never invent behavior the content doesn't support.
    - Prefer real source files in each node's "files" list, and only list paths that appear in the File Paths.
    - Each node's "files" must be its most important SOURCE files: code a beginner would actually read to understand that part. At most 8 files per node. Never list release notes, changelogs, lockfiles, or docs. Exception: when the repo is mostly markdown or template content (skills, prompts, themes, templates), those files in the File Paths are its source and may be listed.
    - Node labels are 2 to 4 words.
    - Edge labels are 2 to 4 words and a verb phrase, like "calls", "reads from", or "sends events to".
    """

    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=RepoAnalysisResponse,
        temperature=0.2,
    )

    used = {}  # which model produced the answer

    async def generate(model):
        response = await client.aio.models.generate_content(model=model, contents=prompt, config=config)
        used["model"] = model
        return response.parsed

    def is_temporary(e):
        return getattr(e, "code", None) in RETRYABLE_CODES

    async def run_generation():
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

    result = await run_generation()

    # Too coarse for a repo this size: ask once for a more detailed breakdown, keeping the first answer if that fails
    if len(result["nodes"]) < MIN_NODES_FOR_BIG_REPO and source_count >= BIG_REPO_SOURCE_FILES:
        log.info("Only %d nodes for %d source files, retrying for more detail", len(result["nodes"]), source_count)
        prompt += (
            f"\n    Your previous answer had only {len(result['nodes'])} nodes, which is too coarse for "
            f"{source_count} source files. Give a more detailed breakdown that follows the 5 to 10 node rule."
        )
        try:
            detailed = await run_generation()
            if len(detailed["nodes"]) > len(result["nodes"]):
                result = detailed
        except HTTPException:
            pass

    result["model"] = used.get("model")
    result["used_fallback"] = used.get("model") == GEMINI_FALLBACK_MODEL
    # Saved with the repo so the chat can reuse it later
    result["github_context"] = {
        "readme": content["readme"],
        "manifests": content["manifests"],
        "tree_truncated": tree_truncated,
    }
    return result

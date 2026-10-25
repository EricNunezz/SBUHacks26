import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

supabase = create_client(
    os.environ["SUPABASE_URL"],
    os.environ["SUPABASE_KEY"],
)

def list_repos():
    result = (
        supabase.table("repos")
        .select("id, owner, name, url, created_at")
        .order("created_at", desc=True)
        .execute()
    )
    return result.data

#function to fill the sidebar repos 
#searched through all columns
#only get the rows where the url matched parameter url 
#returns a list -> either get one repo or None 
def get_repo_by_url(url):
    result = (
        supabase.table("repos")
        .select("*")
        .eq("url", url)
        .execute()
    )
    return result.data[0] if result.data else None

#function to get the repo if it aoready exists within the database 
#skips gemini step entirely 
def get_repo(repo_id):
    result = (
        supabase.table("repos")
        .select("*")
        .eq("id", repo_id)
        .execute()
    )
    return result.data[0] if result.data else None

#function save_repo() saves a repo to supabase 
def save_repo(owner, name, url, summary, diagram, github_context): 
    result = (
        supabase.table("repos")
        .insert({
             "owner": owner,
            "name": name,
            "url": url,
            "summary": summary,
            "diagram": diagram,
            "github_context": github_context,
        })
        .execute()
    )
    return result.data[0] 

# Fills in a repo row that was saved earlier without a diagram
def update_repo_diagram(repo_id, summary, diagram, github_context):
    result = (
        supabase.table("repos")
        .update({
            "summary": summary,
            "diagram": diagram,
            "github_context": github_context,
        })
        .eq("id", repo_id)
        .execute()
    )
    return result.data[0]

def save_message(repo_id, node_id, role, content, file_path=None):
    result = (
        supabase.table("chat_messages")
        .insert({
            "repo_id": repo_id,
            "node_id": node_id or "",  # the column is NOT NULL: "" means "not about a particular node"
            "role": role,
            "content": content,
            "file_path": file_path,
        })
        .execute()
    )
    return result.data[0]


def get_messages(repo_id, node_id):
    result = (
        supabase.table("chat_messages")
        .select("*")
        .eq("repo_id", repo_id)
        .eq("node_id", node_id)
        .order("created_at")
        .execute()
    )
    return result.data


def get_repo_messages(repo_id):
    """The whole chat thread for a repo (every node_id), oldest first."""
    result = (
        supabase.table("chat_messages")
        .select("id, role, content, node_id, file_path, created_at")
        .eq("repo_id", repo_id)
        .order("created_at")
        .execute()
    )
    return result.data

# --- Per-user repos ---
# `repos` is a shared cache; `user_repos` (user_id, repo_id, added_at) says which users have which repo.

def link_repo_to_user(user_id, repo_id):
    # Adding the same pair twice is a no-op
    supabase.table("user_repos").upsert(
        {"user_id": user_id, "repo_id": repo_id},
        on_conflict="user_id,repo_id",
        ignore_duplicates=True,
    ).execute()


def list_user_repos(user_id):
    # Join user_repos -> repos, newest added first
    result = (
        supabase.table("user_repos")
        .select("added_at, repos(id, owner, name, url)")
        .eq("user_id", user_id)
        .order("added_at", desc=True)
        .execute()
    )
    return [{**row["repos"], "added_at": row["added_at"]} for row in result.data]


def user_has_repo(user_id, repo_id):
    result = (
        supabase.table("user_repos")
        .select("repo_id")
        .eq("user_id", user_id)
        .eq("repo_id", repo_id)
        .limit(1)
        .execute()
    )
    return bool(result.data)


def unlink_repo_from_user(user_id, repo_id):
    # Only this user's link is deleted. The shared repos row is never touched.
    supabase.table("user_repos").delete().eq("user_id", user_id).eq("repo_id", repo_id).execute()


# --- Featured repos (public) ---
# repos.is_featured / featured_order / featured_tags (see scripts/featured_schema.sql).
# Every public read goes through these two functions, and both filter on is_featured = true IN the query.

def list_featured_repos():
    result = (
        supabase.table("repos")
        .select("id, owner, name, url, summary, featured_tags, diagram")
        .eq("is_featured", True)
        .not_.is_("diagram", "null")
        .order("featured_order")
        .execute()
    )
    return result.data


def get_featured_repo(repo_id):
    """The repo only if it is featured; None otherwise (missing and not-featured look the same)."""
    result = (
        supabase.table("repos")
        .select("*")
        .eq("id", repo_id)
        .eq("is_featured", True)
        .execute()
    )
    return result.data[0] if result.data else None


def set_featured(repo_id, order, tags):
    supabase.table("repos").update(
        {"is_featured": True, "featured_order": order, "featured_tags": tags}
    ).eq("id", repo_id).execute()


def unfeature_repo(repo_id):
    supabase.table("repos").update(
        {"is_featured": False, "featured_order": None}
    ).eq("id", repo_id).execute()


# --- Catalog (beginner repos imported from awesome-for-beginners) ---
# catalog(id, name, url, owner, repo, language, label, description, repo_id). One row per (repo, language).
# repo_id points at the shared `repos` row once the repo has been mapped.

def list_catalog():
    """Every catalog row with its repo's diagram (null when unmapped). Paged, since PostgREST caps a response at 1000 rows."""
    rows, start = [], 0
    while True:
        page = (
            supabase.table("catalog")
            .select("id, name, owner, repo, url, language, label, description, repo_id, repos(diagram)")
            .order("id")
            .range(start, start + 999)
            .execute()
            .data
        )
        rows += page
        if len(page) < 1000:
            return rows
        start += 1000


def get_catalog_entry(catalog_id):
    result = supabase.table("catalog").select("*").eq("id", catalog_id).execute()
    return result.data[0] if result.data else None


def list_catalog_keys():
    """{(url, language): id} for every existing catalog row."""
    rows, start = [], 0
    while True:
        page = supabase.table("catalog").select("id, url, language").order("id").range(start, start + 999).execute().data
        rows += page
        if len(page) < 1000:
            return {(r["url"], r["language"]): r["id"] for r in rows}
        start += 1000


def insert_catalog_rows(rows):
    if rows:
        supabase.table("catalog").insert(rows).execute()


def update_catalog_row(catalog_id, fields):
    supabase.table("catalog").update(fields).eq("id", catalog_id).execute()


def set_catalog_repo(url, repo_id):
    """Link every catalog row for this url (one per language) to its repos row."""
    supabase.table("catalog").update({"repo_id": repo_id}).eq("url", url).execute()


def list_mapped_repo_urls():
    """{url: repo_id} for repos that already have a diagram."""
    rows, start = [], 0
    while True:
        page = (
            supabase.table("repos").select("id, url").not_.is_("diagram", "null").order("id").range(start, start + 999).execute().data
        )
        rows += page
        if len(page) < 1000:
            return {r["url"]: r["id"] for r in rows}
        start += 1000


def get_explorable_repo(repo_id):
    """A repo anyone may read without logging in: featured, or linked from the catalog (which only happens once it has a diagram).
    None otherwise, so missing and private repos look identical."""
    repo = get_repo(repo_id)
    if not repo:
        return None
    if repo.get("is_featured"):
        return repo
    linked = supabase.table("catalog").select("id").eq("repo_id", repo_id).limit(1).execute().data
    return repo if linked and repo.get("diagram") else None


# file_descriptions(repo_id, file_path, description, created_at), unique (repo_id, file_path).
# Both helpers raise if the table is missing; the router treats that as "no cache".
def get_file_description(repo_id, file_path):
    result = (
        supabase.table("file_descriptions")
        .select("description")
        .eq("repo_id", repo_id)
        .eq("file_path", file_path)
        .execute()
    )
    return result.data[0]["description"] if result.data else None


def save_file_description(repo_id, file_path, description):
    supabase.table("file_descriptions").upsert(
        {"repo_id": repo_id, "file_path": file_path, "description": description},
        on_conflict="repo_id,file_path",
    ).execute()

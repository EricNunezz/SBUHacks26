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

def save_message(repo_id, node_id, role, content):
    result = (
        supabase.table("chat_messages")
        .insert({
            "repo_id": repo_id,
            "node_id": node_id,
            "role": role,
            "content": content,
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


def unlink_repo_from_user(user_id, repo_id):
    # Only this user's link is deleted. The shared repos row is never touched.
    supabase.table("user_repos").delete().eq("user_id", user_id).eq("repo_id", repo_id).execute()

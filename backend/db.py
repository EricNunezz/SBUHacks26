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
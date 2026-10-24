import asyncio
import os
from datetime import datetime, timedelta, timezone
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException

import db
from main import get_current_user_id

router = APIRouter()

CACHE_TTL = timedelta(hours=6)
GITHUB = "https://api.github.com"


def parse_dt(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


async def section(coro):
    """Any failure in one section becomes None instead of failing the request."""
    try:
        return await coro
    except Exception:
        return None


async def gh(client, path, **params):
    res = await client.get(f"{GITHUB}{path}", params=params)
    res.raise_for_status()
    return res.json()


async def get_repo_info(client, o, r):
    d = await gh(client, f"/repos/{o}/{r}")
    return {
        "stars": d["stargazers_count"],
        "forks": d["forks_count"],
        "watchers": d["subscribers_count"],
        "open_issues": d["open_issues_count"],
        "license": (d.get("license") or {}).get("spdx_id"),
        "default_branch": d["default_branch"],
        "size_kb": d["size"],
        "created_at": d["created_at"],
        "pushed_at": d["pushed_at"],
        "topics": d.get("topics", []),
    }


async def get_commits(client, o, r):
    since = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat(timespec="seconds")
    commits = await gh(client, f"/repos/{o}/{r}/commits", since=since, per_page=100)
    return {"count": len(commits), "capped": len(commits) == 100}


async def get_release(client, o, r):
    res = await client.get(f"{GITHUB}/repos/{o}/{r}/releases/latest")
    if res.status_code == 404:
        return None
    res.raise_for_status()
    d = res.json()
    return {"tag": d["tag_name"], "published_at": d["published_at"]}


async def get_community(client, o, r):
    d = await gh(client, f"/repos/{o}/{r}/community/profile")
    files = d.get("files") or {}
    return {
        "health_percentage": d["health_percentage"],
        "has_contributing": bool(files.get("contributing")),
        "has_code_of_conduct": bool(files.get("code_of_conduct")),
        "has_issue_template": bool(files.get("issue_template")),
        "has_readme": bool(files.get("readme")),
    }


async def get_good_first(client, o, r):
    d = await gh(client, "/search/issues", per_page=5,
                 q=f'repo:{o}/{r} is:issue is:open label:"good first issue"')
    return {
        "count": d["total_count"],
        "items": [
            {
                "title": i["title"],
                "url": i["html_url"],
                "number": i["number"],
                "labels": [l["name"] for l in i["labels"]],
                "created_at": i["created_at"],
                "comments": i["comments"],
            }
            for i in d["items"]
        ],
    }


async def get_help_wanted(client, o, r):
    d = await gh(client, "/search/issues", per_page=1,
                 q=f'repo:{o}/{r} is:issue is:open label:"help wanted"')
    return d["total_count"]


async def fetch_stats(o, r):
    headers = {"Accept": "application/vnd.github+json"}
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    async with httpx.AsyncClient(headers=headers, timeout=15) as client:
        repo, langs, community, commits, release, gfi, hw = await asyncio.gather(
            section(get_repo_info(client, o, r)),
            section(gh(client, f"/repos/{o}/{r}/languages")),
            section(get_community(client, o, r)),
            section(get_commits(client, o, r)),
            section(get_release(client, o, r)),
            section(get_good_first(client, o, r)),
            section(get_help_wanted(client, o, r)),
        )

    activity = None
    if repo and commits:
        days = (datetime.now(timezone.utc) - parse_dt(repo["pushed_at"])).days
        activity = {
            "days_since_push": days,
            "commits_90d": commits["count"],
            "commits_90d_capped": commits["capped"],
            "latest_release": release,
        }

    issues = None
    if gfi or hw is not None:
        issues = {
            "good_first_count": gfi["count"] if gfi else None,
            "help_wanted_count": hw,
            "good_first": gfi["items"] if gfi else [],
        }

    return {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "repo": repo,
        "activity": activity,
        "community": community,
        "issues": issues,
        "languages": langs,
    }


@router.get("/api/repos/{repo_id}/stats")
async def get_repo_stats(repo_id: UUID, user_id: str = Depends(get_current_user_id)):
    repo_id = str(repo_id)
    if not db.user_has_repo(user_id, repo_id):
        raise HTTPException(status_code=404, detail="Repo not found")

    rows = (
        db.supabase.table("repos")
        .select("owner, name, stats, stats_fetched_at")
        .eq("id", repo_id)
        .execute()
        .data
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Repo not found")
    row = rows[0]

    if row.get("stats") and row.get("stats_fetched_at"):
        if datetime.now(timezone.utc) - parse_dt(row["stats_fetched_at"]) < CACHE_TTL:
            return row["stats"]

    stats = await fetch_stats(row["owner"], row["name"])
    db.supabase.table("repos").update(
        {"stats": stats, "stats_fetched_at": stats["fetched_at"]}
    ).eq("id", repo_id).execute()
    return stats

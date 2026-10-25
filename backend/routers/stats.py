import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query

import db
from main import get_current_user_id

router = APIRouter()

log = logging.getLogger("uvicorn.error")

CACHE_TTL = timedelta(hours=6)
REFRESH_MIN_AGE = timedelta(seconds=60)  # ?refresh=1 can't be used to hammer GitHub
GITHUB = "https://api.github.com"
STATS_VERSION = 3  # bump when the shape / meaning of the cached stats changes: older cached rows are refetched

# Labels that mean "good for a newcomer". GitHub's label: qualifier is case-insensitive and a comma between values
# means OR, so one query covers all of them (plus the repo's own label from the catalog table, if it has one).
BEGINNER_LABELS = ["good first issue", "good-first-issue", "beginner", "first-timers-only", "easy"]
MAX_ISSUES = 5


def parse_dt(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


async def section(coro):
    """Any failure in one section becomes None instead of failing the request."""
    try:
        return await coro
    except Exception as e:
        log.warning("stats section failed: %s: %s", type(e).__name__, e)
        return None


async def gh(client, path, **params):
    res = await client.get(f"{GITHUB}{path}", params=params)
    remaining = res.headers.get("x-ratelimit-remaining")
    log.info("github GET %s -> %s (rate limit remaining: %s)", res.request.url, res.status_code, remaining)
    if res.is_error:
        # Rate limits and bad queries answer 403/422/429 with a message: keep it in the log
        log.warning("github error body for %s: %s", path, res.text[:300])
        res.raise_for_status()
    data = res.json()
    if path.startswith("/search"):
        log.info("github search total_count=%s incomplete=%s items=%d",
                 data.get("total_count"), data.get("incomplete_results"), len(data.get("items", [])))
    return data


async def parse_repo(d):
    if not d:
        return None  # the repo request failed; the other sections can still be fetched
    return repo_info(d)


def repo_info(d):
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


def label_query(labels):
    """label:"good first issue",good-first-issue,... (values with spaces are quoted; commas mean OR)."""
    return ",".join(f'"{l}"' if " " in l else l for l in labels)


def issue_item(i):
    return {
        "title": i["title"],
        "url": i["html_url"],
        "number": i["number"],
        "labels": [l["name"] for l in i["labels"]],
        "created_at": i["created_at"],
        "comments": i["comments"],
    }


async def search_issues(client, o, r, per_page, labels=None):
    """Open issues in o/r (optionally only those with any of `labels`), newest first. Raises if GitHub errors, so a
    failed search is never mistaken for "no issues"."""
    label = f" label:{label_query(labels)}" if labels else ""
    d = await gh(client, "/search/issues", per_page=per_page, sort="created", order="desc",
                 q=f"repo:{o}/{r} is:issue is:open{label}")
    return d["total_count"], [issue_item(i) for i in d["items"]]


def catalog_label(o, r):
    """The repo's own beginner label from the catalog table (e.g. "good first issue" or "up-for-grabs"), if any."""
    try:
        rows = db.supabase.table("catalog").select("label").ilike("owner", o).ilike("repo", r).execute().data
    except Exception:
        log.exception("catalog label lookup failed for %s/%s", o, r)
        return None
    return next((x["label"].strip() for x in rows if x.get("label") and x["label"].strip()), None)


async def get_issues(client, o, r):
    """Any open issue: `open_count` is the total and `items` the newest 5. Raises if that search fails (the caller
    turns it into a null section). `good_first_count` (issues with a beginner label) is only used by the newcomer
    checklist; if that search fails it is just unknown."""
    own = await asyncio.to_thread(catalog_label, o, r)
    beginner = BEGINNER_LABELS + ([own] if own and own.lower() not in BEGINNER_LABELS else [])
    (open_count, items), good_first = await asyncio.gather(
        search_issues(client, o, r, MAX_ISSUES),
        section(search_issues(client, o, r, 1, beginner)),
    )
    return {"open_count": open_count, "items": items, "good_first_count": good_first[0] if good_first else None}


async def fetch_stats(o, r):
    headers = {"Accept": "application/vnd.github+json"}
    token = os.getenv("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    # follow_redirects: a renamed / transferred repo answers 301 on the REST routes, and the search API doesn't
    # follow renames at all (422), so every section below uses the repo's current name
    async with httpx.AsyncClient(headers=headers, timeout=15, follow_redirects=True) as client:
        raw = await section(gh(client, f"/repos/{o}/{r}"))
        if raw and raw.get("full_name") and raw["full_name"].lower() != f"{o}/{r}".lower():
            log.info("repo %s/%s now lives at %s", o, r, raw["full_name"])
            o, r = raw["full_name"].split("/", 1)
        repo, langs, community, commits, release, issues = await asyncio.gather(
            section(parse_repo(raw)),
            section(gh(client, f"/repos/{o}/{r}/languages")),
            section(get_community(client, o, r)),
            section(get_commits(client, o, r)),
            section(get_release(client, o, r)),
            section(get_issues(client, o, r)),  # None = the request failed, not "no issues"
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

    return {
        "v": STATS_VERSION,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "repo": repo,
        "activity": activity,
        "community": community,
        "issues": issues,
        "languages": langs,
    }


@router.get("/api/repos/{repo_id}/stats")
async def get_repo_stats(repo_id: UUID, refresh: bool = Query(False), user_id: str = Depends(get_current_user_id)):
    """Cached for 6 hours. `?refresh=1` skips the cache (for testing), at most once a minute per repo."""
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

    cached = row.get("stats")
    if cached and row.get("stats_fetched_at") and cached.get("v") == STATS_VERSION:
        age = datetime.now(timezone.utc) - parse_dt(row["stats_fetched_at"])
        if age < (REFRESH_MIN_AGE if refresh else CACHE_TTL):
            return cached

    stats = await fetch_stats(row["owner"], row["name"])
    if stats["issues"] is None:
        # The issue search failed (rate limit, GitHub error): don't cache that, so the next visit tries again
        log.warning("not caching stats for %s/%s: issues section failed", row["owner"], row["name"])
        return stats
    db.supabase.table("repos").update(
        {"stats": stats, "stats_fetched_at": stats["fetched_at"]}
    ).eq("id", repo_id).execute()
    return stats

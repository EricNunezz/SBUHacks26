# backend/routers/auth.py
"""Public helper for the login form: does an account exist for this email? Answers only {"exists": bool}."""
import asyncio
import logging
import re

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

import db
from limits import MINUTE, rate_limit

log = logging.getLogger("uvicorn.error")

router = APIRouter(tags=["auth"])

# Per IP. Tight on purpose: this endpoint reveals whether an email has an account, so it must not be scannable.
CHECK_EMAIL_LIMITS = [(MINUTE, 10), (86400, 50)]
EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$")
PAGE_SIZE = 1000


class CheckEmailBody(BaseModel):
    email: str


def email_exists(email: str) -> bool:
    """Walks Supabase Auth's user list (service-role key) looking for the email, case-insensitively."""
    page = 1
    while True:
        users = db.supabase.auth.admin.list_users(page=page, per_page=PAGE_SIZE)
        if any((u.email or "").strip().lower() == email for u in users):
            return True
        if len(users) < PAGE_SIZE:
            return False
        page += 1


@router.post("/api/auth/check-email")
async def check_email(body: CheckEmailBody, request: Request):
    rate_limit(request, "check-email", CHECK_EMAIL_LIMITS)
    email = body.email.strip().lower()
    if len(email) > 320 or not EMAIL_RE.match(email):
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    try:
        exists = await asyncio.to_thread(email_exists, email)
    except Exception:
        log.error("check-email lookup failed", exc_info=True)
        raise HTTPException(status_code=502, detail="Couldn't check that email right now.")
    return {"exists": exists}

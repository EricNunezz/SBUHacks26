"""Run with: venv/bin/python test_cors.py  (needs SUPABASE_URL / SUPABASE_KEY / GEMINI_API_KEY set, any values)"""
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def preflight(origin):
    return client.options(
        "/api/me/repos",
        headers={"Origin": origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"},
    )


for origin in ("https://www.gitstation.nyc", "https://gitstation.nyc", "https://sbu-hacks26.vercel.app", "http://localhost:5173"):
    res = preflight(origin)
    assert res.status_code == 200, (origin, res.status_code, res.text)
    assert res.headers["access-control-allow-origin"] == origin, (origin, res.headers)

res = client.get("/api/health", headers={"Origin": "https://www.gitstation.nyc"})
assert res.headers["access-control-allow-origin"] == "https://www.gitstation.nyc"

res = preflight("https://evil.example")
assert res.status_code == 400 and "access-control-allow-origin" not in res.headers
print("cors ok")

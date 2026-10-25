# Deploying: Vercel (frontend) + Render (backend)

Deploy the backend first so you have its URL for the frontend.

## 1. Supabase (once)

1. SQL editor: run `backend/scripts/usage_schema.sql` (rate limits) and `backend/scripts/featured_schema.sql` if you haven't. Your other tables (`repos`, `user_repos`, `chat_messages`, `catalog`, `file_descriptions`) must already exist in this project.
2. Project Settings > API: copy the **Project URL**, the **publishable (anon) key** (frontend) and the **service-role key** (backend only; never put it in the frontend).

## 2. Backend on Render

New > **Web Service** > connect the GitHub repo.

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Runtime | Python 3 (Render reads `backend/.python-version` = 3.12) |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/api/health` |
| Instance type | Free works for a demo, but it sleeps after ~15 min idle (first request takes ~30-60 s). Use Starter to avoid that. |

If Render ignores the Python version, also set env var `PYTHON_VERSION=3.12.8`.

Environment variables:

| Name | Required | Value |
|---|---|---|
| `SUPABASE_URL` | yes | Supabase Project URL |
| `SUPABASE_KEY` | yes | Supabase **service-role** key |
| `GEMINI_API_KEY` | yes | Google AI Studio key |
| `GITHUB_TOKEN` | strongly recommended | GitHub token (no scopes needed for public repos); without it GitHub's 60 requests/hour limit breaks mapping |
| `ALLOWED_ORIGINS` | yes | Your Vercel URL(s), comma-separated, no trailing slash, e.g. `https://your-app.vercel.app,https://yourdomain.com` |
| `GEMINI_DAILY_CAP` | no | Default 1500 Gemini-backed actions/day across all users |
| `IP_LIMIT_MULTIPLIER` | no | Default 3 (per-IP limit = per-user limits x this) |
| `TRUST_PROXY` | no | Not needed on Render (it is detected automatically and the client IP is read from `X-Forwarded-For`). Set `1` on other hosts behind a proxy. |
| `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | no | Override the default models |

Check it: open `https://<service>.onrender.com/api/health` and expect `{"status":"ok"}`.

## 3. Frontend on Vercel

New Project > import the repo.

| Setting | Value |
|---|---|
| Root Directory | `frontend` |
| Framework Preset | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm install` |

Environment variables (Production and Preview; they are baked in at build time, so redeploy after changing them):

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key |
| `VITE_API_URL` | Render URL, e.g. `https://<service>.onrender.com` (no trailing slash, no `/api`) |

`frontend/vercel.json` rewrites every route to `index.html`, so `/repo/<id>` and `/explore` survive a refresh.

After the first deploy, copy the Vercel URL into Render's `ALLOWED_ORIGINS` (Render redeploys on save).

## 4. Supabase Auth URL settings

Authentication > URL Configuration:

- **Site URL**: your production frontend URL, e.g. `https://your-app.vercel.app`. Confirmation emails link here (the app doesn't set its own redirect), so leaving it at `http://localhost:3000` sends new users to a dead link.
- **Redirect URLs**: add `https://your-app.vercel.app/**`, your custom domain if any, and keep `http://localhost:5173/**` for local dev. For Vercel preview deployments add `https://*-<your-team>.vercel.app/**`.

## 5. Anything else to change for production

- **Rotate any key that was ever committed or pasted anywhere** (Gemini, GitHub, Supabase service-role). `.env` files are git-ignored; keep it that way.
- **Preview deployments**: each preview has a different URL, so API calls from it fail CORS unless that origin is in `ALLOWED_ORIGINS`. Easiest: test on the production URL.
- **Rate-limit state**: per-IP counters are in memory, so they reset on every deploy/restart and aren't shared across multiple instances. Run one instance, or move them to Redis/Supabase if you scale out. Per-user limits and the daily cap live in Supabase and survive restarts.
- **`X-Forwarded-For` trust**: the limiter uses the first address in the header. That is correct behind Render's proxy, but if you put another proxy/CDN (e.g. Cloudflare) in front, check the header's real shape or clients can spoof their IP.
- **Cold starts**: on Render's free tier the first request after idle is slow and the navbar backend indicator shows "disconnected" until it wakes; consider a cron ping to `/api/health` or a paid instance.
- **Long requests**: mapping a repo can take up to a minute. Render allows this; just don't put a shorter-timeout proxy in front.
- **Local data scripts**: `backend/scripts/*` (catalog import, premap, seed featured) read the same `.env` and are meant to be run from your machine against the production Supabase, not on Render. `backend/my_repos.txt` is input for `import_my_catalog.py`.
- **Dev proxy only applies locally**: Vite's `/api` proxy is not used in production; with `VITE_API_URL` empty a deployed build would call Vercel's own `/api` and 404.
- **Supabase**: consider turning on email rate limits / CAPTCHA in Auth settings, since mass sign-ups are the abuse path the per-IP limit is aimed at. The default built-in email sender is heavily rate-limited; configure custom SMTP for real traffic.
- **Custom domain**: if you add one, add it to `ALLOWED_ORIGINS` and the Supabase redirect URLs.

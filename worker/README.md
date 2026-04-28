# Honsulmap migration worker

Python cron that scrapes Instagram stories via [storysaver.net](https://storysaver.net) and writes them to the same Supabase tables (`spots`, `stories`) the Next.js site already reads. Replaces the failing Vercel cron at `src/app/api/cron/scrape/route.ts`, which talks to Instagram directly and breaks every time the IG session cookies are invalidated.

## Why storysaver.net

* It re-renders an account's active stories with the original `cdninstagram.com` media URLs intact, so we keep the same data contract the site uses today.
* Cloudflare Turnstile guards the form submit, but Scrapling's stealth Chromium auto-solves it without an external CAPTCHA service.
* No IG cookies, no IG-side rate limits to manage on our end.

The Next.js site does not need to change — story rows look identical to what the Vercel cron used to insert (`instagram_media_id` upsert key, `posted_at`/`expires_at`, `media_url`, `thumbnail_url`).

## Layout

```
worker/
  scrape.py              entry point — pulls a batch, fans out, summarizes
  storysaver_client.py   Scrapling page_action wrapper around storysaver.net
  parser.py              BeautifulSoup-based story extractor
  db.py                  Supabase client + the 3 ops we need
  test_smoke.py          one-shot fetch_stories() check, no DB writes
  requirements.txt
  render.yaml            Render Cron Job blueprint
  .env.example
```

## Local dev

The repo ships a Python 3.13 venv at `worker_venv/`. From the repo root:

```powershell
# 1. install / refresh deps (only needed first time)
worker_venv\Scripts\pip.exe install -r worker\requirements.txt
worker_venv\Scripts\python.exe -m playwright install chromium

# 2. smoke test (no DB writes)
worker_venv\Scripts\python.exe worker\test_smoke.py sosu.jeju

# 3. real run against staging/prod Supabase
copy worker\.env.example worker\.env   # then fill SUPABASE_* values
worker_venv\Scripts\python.exe -m worker.scrape
```

`scrape.py` requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. It reads `.env` from the repo root *and* from `worker/.env`; `BATCH_SIZE`, `WORKERS`, and `SPOT_TIMEOUT_SEC` are optional tunables.

The expected log line on success:

```
processed=15 stories=87 errors=0 elapsed=215.4s
```

## Deploy to Render

1. Push this branch to GitHub.
2. In Render → **New** → **Blueprint**, point it at the Honsulmap repo. Render reads `worker/render.yaml`.
3. Confirm the service:
   - Type: **Cron Job**
   - Schedule: `*/5 * * * *` (every 5 minutes)
   - Build: `pip install -r worker/requirements.txt && python -m playwright install chromium`
   - Start: `python -m worker.scrape`
4. In the Render dashboard, set the secret env vars (they are `sync: false` in the blueprint so they must be entered manually):
   - `SUPABASE_URL` — same as Vercel
   - `SUPABASE_SERVICE_ROLE_KEY` — same as Vercel
   - (Optional) override `BATCH_SIZE`, `WORKERS`
5. Trigger a manual run and watch the logs. A healthy first run prints `processed=N stories=M …`. Verify rows in Supabase: `select count(*) from stories where scraped_at > now() - interval '10 min';`.
6. Once Render is reliably populating `stories`, remove the Vercel cron entry from `vercel.json` (separate PR).

## Troubleshooting

* **`playwright._impl._errors.Error: BrowserType.launch: Executable doesn't exist`** — Render didn't run the post-install. Re-deploy with the build command shown above; locally run `python -m playwright install chromium` once.
* **`AuthApiError: Invalid API key`** — `SUPABASE_SERVICE_ROLE_KEY` is wrong or has the anon key by mistake. Check Supabase → Project Settings → API.
* **`processed=15 stories=0`** — every spot returned zero records. Likely a storysaver.net outage. Confirm with `worker_venv\Scripts\python.exe worker\test_smoke.py instagram` against the official `instagram` handle.
* **Smoke test prints `WARNING — no records`** — the chosen handle has no live stories. Try `chae_jeju` or another active spot.
* **`Timeout 120000ms exceeded`** in worker logs — storysaver.net is slow today; raise `STORYSAVER_TIMEOUT_MS` env var.
* **Render free plan kills cron** — the blueprint specifies `plan: starter` (~$1/month). Free plan has too short a wallclock budget for a full 8-process scrape.

## Future

* Mirror story media to Cloudflare R2 so the Next.js feed stops 404-ing when IG CDN URLs expire (~24-48h after upload).
* Re-implement the IG-direct path as a fallback when storysaver.net is down — cookies in env, no Vercel timeout to fight.
* Backfill `instagram_user_id` on `spots` by resolving handles via the IG GraphQL endpoint — the existing site code prefers it.

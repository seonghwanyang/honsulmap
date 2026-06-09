"""Adaptive-scheduling variant of the scrape worker.

Staged as a SEPARATE module so the live ``worker.scrape`` loop keeps running
unchanged until this is verified. Nothing here touches ``worker/scrape.py`` or
``worker/db.py`` — it reuses their pure helpers and adds the adaptive bits.

Differences from ``worker.scrape``:
* Only pulls spots that are *due* (``spots.next_scrape_at <= now()``).
* After each spot: stories  -> ``next_scrape_at = now + BASE_INTERVAL_MIN``,
  ``consecutive_empty = 0``; empty or errored -> exponential backoff
  (``BASE * 2**streak``) capped at 24h. So dead/quiet spots drift out to a
  daily check while active spots stay on the base cadence.
* ``DRY_RUN=1`` fetches and PRINTS the computed schedule but writes nothing
  (no stories, no schedule) — safe to run against prod with no side effects.

Requires the ``2026-06-06_adaptive_scrape_scheduling.sql`` migration (adds
``spots.consecutive_empty`` + ``spots.next_scrape_at``). Run it first.

Usage:
    DRY_RUN=1 BATCH_SIZE=5 python -m worker.scrape_adaptive   # safe test
    BATCH_SIZE=1 python -m worker.scrape_adaptive             # one real spot
    python -m worker.scrape_adaptive                          # full adaptive run

Env knobs: DRY_RUN, BATCH_SIZE, WORKERS, BASE_INTERVAL_MIN (default 30),
SPOT_TIMEOUT_SEC.
"""
from __future__ import annotations

import multiprocessing
import os
import sys
import time
import traceback
from datetime import datetime, timedelta, timezone
from queue import Empty
from typing import Any

# Reuse the unchanged pure helpers from the live worker — no duplication and
# no behavioural drift between the two.
from worker.scrape import _build_story_row, _purge_browser_temp_dirs, _utcnow_iso


def _dry_run() -> bool:
    return os.environ.get("DRY_RUN", "").strip().lower() in ("1", "true", "yes")


def _select_due_spots(client: Any, limit: int) -> list[dict[str, Any]]:
    """Spots that are due (next_scrape_at <= now) with a non-empty IG handle,
    most-overdue first."""
    now_iso = datetime.now(timezone.utc).isoformat()
    resp = (
        client.table("spots")
        .select("id, name, instagram_id, last_scraped_at, consecutive_empty, next_scrape_at")
        .not_.is_("instagram_id", None)
        .neq("instagram_id", "")
        .lte("next_scrape_at", now_iso)
        .order("next_scrape_at", desc=False, nullsfirst=True)
        .limit(limit)
        .execute()
    )
    return resp.data or []


def _update_scrape_schedule(
    client: Any,
    spot_id: str,
    *,
    consecutive_empty: int,
    next_scrape_at_iso: str,
    last_scraped_at_iso: str,
) -> None:
    client.table("spots").update(
        {
            "last_scraped_at": last_scraped_at_iso,
            "consecutive_empty": consecutive_empty,
            "next_scrape_at": next_scrape_at_iso,
        }
    ).eq("id", spot_id).execute()


def _next_interval_min(*, had_stories: bool, prev_empty: int, base_min: int, max_min: int) -> tuple[int, int]:
    """Return (new_consecutive_empty, interval_minutes)."""
    if had_stories:
        return 0, base_min
    new_empty = prev_empty + 1
    # cap the exponent so the int stays small once we've clamped to max anyway
    return new_empty, min(base_min * (2 ** min(new_empty, 20)), max_min)


# ---------------------------------------------------------------------------
# Self-contained fetch + parser (ADAPTIVE ONLY — does not touch the live
# worker.storysaver_client / worker.parser). Handles BOTH storysaver output
# formats: the raw cdninstagram.com URLs the live parser knows, AND the newer
# get-cdn-image/<base64> proxy format the live parser silently drops.
# ---------------------------------------------------------------------------


def _build_page_action_v2(handle: str):
    """Same form-fill as the live page_action, but the result poll exits the
    moment EITHER a raw cdninstagram.com URL OR storysaver's get-cdn-image
    proxy appears — so format-B pages don't burn the full 60s deadline.
    (The live _build_page_action only looks for cdninstagram.com, so it waits
    the whole 60s on get-cdn-image pages.)"""
    from worker.storysaver_client import (
        RESULT_POLL_DEADLINE_SEC,
        RESULT_POLL_INTERVAL_MS,
    )

    def page_action(page: Any) -> Any:
        try:
            page.wait_for_load_state("domcontentloaded", timeout=30_000)
        except Exception:
            pass
        try:
            page.wait_for_timeout(2_000)
        except Exception:
            pass

        for sel in (
            'input[name="username"]',
            'input[id="username"]',
            'input[type="text"]',
            'input[placeholder*="user" i]',
        ):
            try:
                el = page.query_selector(sel)
                if el and el.is_visible():
                    el.click()
                    page.wait_for_timeout(150)
                    el.fill(handle)
                    break
            except Exception:
                continue

        clicked = False
        for sel in (
            'input[type="submit"]',
            'button[type="submit"]',
            'button:has-text("Download")',
            'button:has-text("Submit")',
            'button:has-text("Search")',
            "#submit",
            "button.btn",
        ):
            try:
                btn = page.query_selector(sel)
                if btn and btn.is_visible():
                    btn.click()
                    clicked = True
                    break
            except Exception:
                continue
        if not clicked:
            try:
                page.evaluate(
                    "document.querySelector('form')?.requestSubmit?.()"
                    " || document.querySelector('form')?.submit?.()"
                )
            except Exception:
                pass

        deadline = time.time() + RESULT_POLL_DEADLINE_SEC
        last_content = ""
        found = False
        while time.time() < deadline:
            try:
                last_content = page.content()
            except Exception:
                break
            if "cdninstagram.com" in last_content or "get-cdn-image" in last_content:
                found = True
                break
            try:
                page.wait_for_timeout(RESULT_POLL_INTERVAL_MS)
            except Exception:
                break

        if not found:
            low = last_content.lower()
            tags = []
            if "turnstile" in low or "challenges.cloudflare.com" in low:
                tags.append("turnstile-still-present")
            if "connection error" in low:
                tags.append("connection-error")
            if not tags:
                tags.append("unknown")
            print(
                f"[storysaver] handle={handle} no-result-after-poll "
                f"tags={','.join(tags)} len={len(last_content)}",
                flush=True,
            )
        return page

    return page_action


def _fetch_html(handle: str) -> str:
    """Drive storysaver and return the raw result HTML. Uses the adaptive
    page_action so the result poll doesn't wait 60s on get-cdn-image pages."""
    from scrapling.fetchers import StealthyFetcher
    from worker.storysaver_client import DEFAULT_FETCH_TIMEOUT_MS, SITE_URL

    timeout_ms = int(os.getenv("STORYSAVER_TIMEOUT_MS", DEFAULT_FETCH_TIMEOUT_MS))
    resp = StealthyFetcher.fetch(
        SITE_URL,
        headless=True,
        solve_cloudflare=False,
        network_idle=True,
        timeout=timeout_ms,
        wait=2_000,
        page_action=_build_page_action_v2(handle),
        google_search=True,
        block_ads=True,
        disable_resources=False,
    )
    body = getattr(resp, "body", None)
    if isinstance(body, bytes):
        enc = getattr(resp, "encoding", "") or "utf-8"
        try:
            return body.decode(enc, errors="replace")
        except LookupError:
            return body.decode("utf-8", errors="replace")
    if isinstance(body, str):
        return body
    return getattr(resp, "html_content", "") or ""


def _decode_proxy(url: str | None) -> str | None:
    """storysaver proxies media as scontentN.storysaver.net/get-cdn-image/<b64>
    where <b64> is the real signed cdninstagram.com URL. Decode it back."""
    if not url or "get-cdn-image/" not in url:
        return None
    import base64

    seg = url.split("get-cdn-image/", 1)[1]
    # Strip query/fragment but NOT '/' — standard base64 contains '/', and the
    # encoded URL's signed query (?efg&oh&oe) must survive or IG returns 403.
    seg = seg.split("?", 1)[0].split("#", 1)[0].rstrip("=")
    pad = "=" * (-len(seg) % 4)
    for decoder in (base64.b64decode, base64.urlsafe_b64decode):
        try:
            real = decoder(seg + pad).decode("utf-8", "replace")
        except Exception:
            continue
        if "cdninstagram.com" in real or "fbcdn.net" in real:
            return real
    return None


def _is_profile_pic(url: str | None) -> bool:
    """IG profile pictures leak into storysaver results (the account avatar
    shown next to each story) — they are NOT stories. They use the '-19' CDN
    path and tiny s100x100 / s150x150 crops; real stories use '-15' or video
    paths at full size."""
    if not url:
        return False
    import re

    u = url.lower()
    if "s100x100" in u or "s150x150" in u:
        return True
    return bool(re.search(r"t51\.\d+-19/", url))


def _find_url_v2(item: Any) -> str | None:
    from worker.parser import _is_cdn_url

    # Format A — raw cdn url in anchor / video / img (skip profile pics)
    for a in item.find_all("a", href=True):
        if _is_cdn_url(a["href"]) and not _is_profile_pic(a["href"]):
            return a["href"]
    for v in item.find_all("video"):
        if v.has_attr("src") and _is_cdn_url(v["src"]):
            return v["src"]
        for s in v.find_all("source", src=True):
            if _is_cdn_url(s["src"]):
                return s["src"]
    for img in item.find_all("img", src=True):
        if _is_cdn_url(img["src"]) and not _is_profile_pic(img["src"]):
            return img["src"]
    # Format B — get-cdn-image proxy → decode (skip if it's a profile pic)
    for img in item.find_all("img", src=True):
        d = _decode_proxy(img["src"])
        if d and not _is_profile_pic(d):
            return d
    for a in item.find_all("a", href=True):
        d = _decode_proxy(a["href"])
        if d and not _is_profile_pic(d):
            return d
    return None


def _extract_stories_v2(html: str) -> list[dict[str, str | None]]:
    from bs4 import BeautifulSoup
    from worker.parser import _find_relative_ts, _media_type_for

    soup = BeautifulSoup(html, "lxml")
    container = soup.select_one("#sonucc") or soup
    # both the old (stylestory) and new (stylefirst) item classes
    items = container.select("li.stylestory, li.stylefirst")
    out: list[dict[str, str | None]] = []
    for item in items:
        url = _find_url_v2(item)
        if not url:
            continue
        out.append(
            {
                "media_url": url,
                "media_type": _media_type_for(url),
                "thumbnail_url": None,
                "posted_relative": _find_relative_ts(item),
            }
        )
    return out


# ---------------------------------------------------------------------------
# Worker process
# ---------------------------------------------------------------------------


def _worker_loop(
    job_queue: "multiprocessing.Queue[dict[str, Any] | None]",
    result_queue: "multiprocessing.Queue[dict[str, Any]]",
) -> None:
    from worker.db import get_client, upsert_stories

    dry_run = _dry_run()
    base_min = max(1, int(os.environ.get("BASE_INTERVAL_MIN", "30")))
    max_min = 24 * 60

    try:
        client = get_client()
    except Exception as exc:  # pragma: no cover — env misconfigured
        result_queue.put(
            {
                "spot_id": None,
                "stories": 0,
                "errored": True,
                "error": f"db_init: {type(exc).__name__}: {exc}",
            }
        )
        return

    while True:
        try:
            job = job_queue.get(timeout=1.0)
        except Empty:
            continue
        if job is None:
            return

        spot_id: str = job["id"]
        handle: str = job["instagram_id"]
        prev_empty = int(job.get("consecutive_empty") or 0)
        fetch_time = datetime.now(timezone.utc)

        result: dict[str, Any] = {
            "spot_id": spot_id,
            "handle": handle,
            "stories": 0,
            "errored": False,
            "error": None,
        }
        had_stories = False
        try:
            records = _extract_stories_v2(_fetch_html(handle))
            rows = [
                _build_story_row(
                    spot_id=spot_id,
                    instagram_handle=handle,
                    record=r,
                    fetch_time=fetch_time,
                )
                for r in records
            ]
            rows = [r for r in rows if r is not None]
            had_stories = len(rows) > 0
            if dry_run:
                result["stories"] = len(rows)
                result["sample_url"] = rows[0]["media_url"] if rows else None
            else:
                result["stories"] = upsert_stories(client, rows)
        except Exception as exc:
            result["errored"] = True
            result["error"] = f"{type(exc).__name__}: {exc}"
            traceback.print_exc()
        finally:
            new_empty, interval_min = _next_interval_min(
                had_stories=had_stories,
                prev_empty=prev_empty,
                base_min=base_min,
                max_min=max_min,
            )
            next_at = fetch_time + timedelta(minutes=interval_min)
            result["next_in_min"] = interval_min
            if dry_run:
                su = (result.get("sample_url") or "")[:75]
                print(
                    f"[scrape:DRY] spot={handle} stories={result['stories']} "
                    f"empty={prev_empty}->{new_empty} next_in={interval_min}min "
                    f"url={su} (NO DB WRITE)",
                    flush=True,
                )
            else:
                try:
                    _update_scrape_schedule(
                        client,
                        spot_id,
                        consecutive_empty=new_empty,
                        next_scrape_at_iso=next_at.isoformat(),
                        last_scraped_at_iso=_utcnow_iso(),
                    )
                except Exception as exc:
                    result.setdefault("error", f"schedule: {exc}")
            result_queue.put(result)


# ---------------------------------------------------------------------------
# Main process
# ---------------------------------------------------------------------------


def main() -> int:
    from dotenv import load_dotenv

    _purge_browser_temp_dirs()

    repo_root = os.path.dirname(os.path.dirname(__file__))
    load_dotenv()
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
    load_dotenv(os.path.join(repo_root, ".env.local"))

    has_url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    has_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not has_url or not has_key:
        missing = []
        if not has_url:
            missing.append("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)")
        if not has_key:
            missing.append("SUPABASE_SERVICE_ROLE_KEY")
        print(f"[scrape] missing env: {missing}", file=sys.stderr)
        return 2

    batch_size = int(os.environ.get("BATCH_SIZE", "15"))
    workers = max(1, int(os.environ.get("WORKERS", "4")))
    dry_run = _dry_run()
    if dry_run:
        print("[scrape] DRY_RUN — fetching only, no DB writes (stories or schedule)")

    from worker.db import get_client

    client = get_client()
    spots = _select_due_spots(client, batch_size)
    if not spots:
        print("[scrape] no spots due processed=0 stories=0 errors=0 elapsed=0s")
        return 0

    workers = min(workers, len(spots))
    print(
        f"[scrape] {len(spots)} spots due — booting {workers} worker(s) + browsers, "
        f"fetching (first lines can take 30-60s)...",
        flush=True,
    )

    ctx = multiprocessing.get_context("spawn")
    job_queue: multiprocessing.Queue = ctx.Queue()
    result_queue: multiprocessing.Queue = ctx.Queue()

    for spot in spots:
        job_queue.put(
            {
                "id": spot["id"],
                "instagram_id": spot["instagram_id"],
                "consecutive_empty": spot.get("consecutive_empty", 0),
            }
        )
    for _ in range(workers):
        job_queue.put(None)  # sentinel per worker

    started_at = time.time()
    procs = [
        ctx.Process(target=_worker_loop, args=(job_queue, result_queue), daemon=False)
        for _ in range(workers)
    ]
    for p in procs:
        p.start()

    total_stories = 0
    errors = 0
    processed = 0

    spot_timeout = int(os.environ.get("SPOT_TIMEOUT_SEC", "120"))
    deadline = started_at + spot_timeout * len(spots)

    while processed < len(spots) and time.time() < deadline:
        try:
            res = result_queue.get(timeout=2.0)
        except Empty:
            if all(not p.is_alive() for p in procs):
                break
            continue
        processed += 1
        total_stories += int(res.get("stories") or 0)
        if res.get("errored"):
            errors += 1
            print(
                f"[scrape] spot={res.get('handle')} ERROR {res.get('error')}",
                file=sys.stderr,
            )
        elif not dry_run:
            print(
                f"[scrape] spot={res.get('handle')} stories={res.get('stories')} "
                f"next_in={res.get('next_in_min')}min"
            )

    for p in procs:
        p.join(timeout=10)
        if p.is_alive():
            p.terminate()

    elapsed = time.time() - started_at
    print(
        f"processed={processed} stories={total_stories} errors={errors} elapsed={elapsed:.1f}s",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

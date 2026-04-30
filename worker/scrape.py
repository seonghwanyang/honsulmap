"""Honsulmap migration worker entry point.

Architecture
============
* Pull a batch of spots from Supabase (oldest ``last_scraped_at`` first).
* Distribute them across ``WORKERS`` ``multiprocessing.Process`` workers
  via a ``Queue``. Each worker boots its own Scrapling browser, so we get
  true parallelism — the previous async-loop sharing experiment failed in
  ``scripts/storysaver_parallel_test.py``'s sibling tests.
* Each worker performs:
    1. ``fetch_stories(handle)`` against storysaver.net.
    2. Map each parsed record to the existing ``stories`` schema:
       ``instagram_media_id`` (extracted from the IG CDN path), ``posted_at``
       (parsed from the relative timestamp), ``expires_at = posted_at + 24h``.
    3. ``upsert(on_conflict='instagram_media_id')`` so re-runs are idempotent
       and we keep historical rows even past 24h (matches the existing
       Vercel route's invariant — see commit ``94931df``).
    4. Bump ``spots.last_scraped_at``.
* Print a summary line for the Render log: ``processed=… stories=… errors=…``.

The worker is intentionally self-contained — no Vercel/Next.js code under
``src/`` is touched. The Vercel cron stays live until Render is verified
in production; flipping over later is a single edit to ``vercel.json``.
"""
from __future__ import annotations

import multiprocessing
import os
import re
import sys
import time
import traceback
from datetime import datetime, timedelta, timezone
from queue import Empty
from typing import Any
from urllib.parse import urlparse


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _extract_media_id(cdn_url: str) -> str | None:
    """Pull a stable Instagram media id from a CDN URL.

    There are two URL shapes on storysaver output:

    * **Images** — ``.../t51.../<media_id>_<post_id>_<author_id>_n.jpg``.
      Take the leading numeric segment of the basename.
    * **Videos** — ``.../o1/v/t2/...<opaque>.mp4`` plus a base64-encoded
      ``efg`` query param containing ``xpv_asset_id``. We decode that to
      recover the canonical numeric story id (matches ``items[].pk`` on
      the IG private API used by the legacy Vercel cron).

    Falls back to ``vs=<hex>`` (a per-URL session id) only as a last
    resort — it changes per refresh, so it's a weak conflict key, but at
    least won't be ``None``.
    """
    import base64
    import json
    from urllib.parse import parse_qs

    try:
        parsed = urlparse(cdn_url)
    except ValueError:
        return None

    fname = parsed.path.rsplit("/", 1)[-1]
    if fname:
        head = fname.split("_", 1)[0]
        # IG image basenames lead with the numeric media_id (>=6 digits in
        # practice). The opaque video filenames start with letters, so
        # this branch only matches the image case.
        if head.isdigit() and len(head) >= 6:
            return head

    qs = parse_qs(parsed.query)

    # Video: decode efg → xpv_asset_id
    efg_vals = qs.get("efg") or []
    for efg in efg_vals:
        try:
            padded = efg + "=" * (-len(efg) % 4)
            payload = json.loads(base64.b64decode(padded).decode("utf-8", "replace"))
        except Exception:
            continue
        asset_id = payload.get("xpv_asset_id")
        if asset_id:
            return str(asset_id)

    # Last resort: a leading numeric run anywhere in the filename.
    m = re.search(r"(\d{10,})", fname)
    if m:
        return m.group(1)

    # Even weaker: per-URL session id (changes between refreshes — only
    # used so the row still has a non-empty unique key for upsert).
    vs_vals = qs.get("vs") or []
    if vs_vals:
        return f"vs:{vs_vals[0]}"

    return None


def _parse_relative_ts(text: str | None, *, fetch_time: datetime) -> datetime:
    """Resolve a storysaver relative timestamp to a UTC ``datetime``.

    ``dateparser`` handles "10 minutes ago", "5 hours ago", "yesterday",
    "just now". When the input is missing or unparseable we fall back to
    ``fetch_time`` so the row still satisfies the NOT NULL ``posted_at``
    constraint — the worst case is the story falls out of the 24h window
    one cycle late.
    """
    if not text:
        return fetch_time
    import dateparser  # local import keeps cold-start light

    parsed = dateparser.parse(
        text,
        settings={
            "RELATIVE_BASE": fetch_time.replace(tzinfo=None),
            "TIMEZONE": "UTC",
            "RETURN_AS_TIMEZONE_AWARE": True,
            "PREFER_DATES_FROM": "past",
        },
    )
    if parsed is None:
        return fetch_time
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _build_story_row(
    *,
    spot_id: str,
    instagram_handle: str,
    record: dict[str, Any],
    fetch_time: datetime,
) -> dict[str, Any] | None:
    media_url = record.get("media_url")
    if not media_url:
        return None
    media_id = _extract_media_id(media_url)
    if not media_id:
        return None
    posted_at = _parse_relative_ts(record.get("posted_relative"), fetch_time=fetch_time)
    expires_at = posted_at + timedelta(hours=24)
    return {
        "spot_id": spot_id,
        "instagram_id": instagram_handle,
        "instagram_media_id": media_id,
        "media_url": media_url,
        "media_type": record.get("media_type") or "image",
        "thumbnail_url": record.get("thumbnail_url"),
        "posted_at": posted_at.isoformat(),
        "expires_at": expires_at.isoformat(),
        "scraped_at": fetch_time.isoformat(),
    }


# ---------------------------------------------------------------------------
# Worker process
# ---------------------------------------------------------------------------


def _worker_loop(
    job_queue: "multiprocessing.Queue[dict[str, Any] | None]",
    result_queue: "multiprocessing.Queue[dict[str, Any]]",
) -> None:
    """Pop spots off ``job_queue`` until a sentinel ``None`` arrives."""
    # Re-import inside subprocess so each has its own module state.
    from worker.db import get_client, update_last_scraped_at, upsert_stories
    from worker.storysaver_client import fetch_stories

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
        fetch_time = datetime.now(timezone.utc)

        result: dict[str, Any] = {
            "spot_id": spot_id,
            "handle": handle,
            "stories": 0,
            "errored": False,
            "error": None,
        }
        try:
            records = fetch_stories(handle)
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
            inserted = upsert_stories(client, rows)
            result["stories"] = inserted
        except Exception as exc:
            result["errored"] = True
            result["error"] = f"{type(exc).__name__}: {exc}"
            traceback.print_exc()
        finally:
            try:
                update_last_scraped_at(client, spot_id, _utcnow_iso())
            except Exception as exc:
                result.setdefault("error", f"last_scraped: {exc}")
            result_queue.put(result)


# ---------------------------------------------------------------------------
# Main process
# ---------------------------------------------------------------------------


def main() -> int:
    from dotenv import load_dotenv

    # Load .env from repo root and from worker/ — both convenient. Also
    # pick up Next.js's .env.local, which is what a developer running the
    # worker on their own machine already has populated.
    repo_root = os.path.dirname(os.path.dirname(__file__))
    load_dotenv()
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
    load_dotenv(os.path.join(repo_root, ".env.local"))

    has_url = os.environ.get("SUPABASE_URL") or os.environ.get(
        "NEXT_PUBLIC_SUPABASE_URL"
    )
    has_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not has_url or not has_key:
        missing: list[str] = []
        if not has_url:
            missing.append("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)")
        if not has_key:
            missing.append("SUPABASE_SERVICE_ROLE_KEY")
        print(f"[scrape] missing env: {missing}", file=sys.stderr)
        return 2

    batch_size = int(os.environ.get("BATCH_SIZE", "15"))
    workers = max(1, int(os.environ.get("WORKERS", "8")))

    from worker.db import get_client, select_spots_for_scrape

    client = get_client()
    spots = select_spots_for_scrape(client, batch_size)
    if not spots:
        print("[scrape] no spots queued processed=0 stories=0 errors=0 elapsed=0s")
        return 0

    workers = min(workers, len(spots))

    # ``spawn`` matches our prototype + works on macOS/Windows for local dev.
    ctx = multiprocessing.get_context("spawn")
    job_queue: multiprocessing.Queue = ctx.Queue()
    result_queue: multiprocessing.Queue = ctx.Queue()

    for spot in spots:
        job_queue.put({"id": spot["id"], "instagram_id": spot["instagram_id"]})
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
        else:
            print(
                f"[scrape] spot={res.get('handle')} stories={res.get('stories')}"
            )

    for p in procs:
        p.join(timeout=10)
        if p.is_alive():
            p.terminate()

    elapsed = time.time() - started_at
    print(
        f"processed={processed} stories={total_stories} errors={errors} elapsed={elapsed:.1f}s"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

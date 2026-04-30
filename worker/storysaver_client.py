"""Scrapling-based scraper for ``https://storysaver.net``.

Approach (proven in ``scripts/storysaver_v2.py``)
=================================================
1. Open the homepage *without* ``solve_cloudflare=True``. The homepage has
   no challenge — turning the bypass on actually wastes ~10s before form
   render and sometimes traps the navigation.
2. Fill the username text input + click the submit button. The submit
   triggers a Turnstile widget which Scrapling's stealth Chromium auto-
   solves transparently.
3. Poll ``page.content()`` for the substring ``cdninstagram.com``. As soon
   as the result HTML appears, capture and return it.
4. Parse with :func:`worker.parser.extract_stories`.

The function is process-safe — every call drives its own browser instance.
We rely on ``multiprocessing`` (spawn) for parallelism; threads would share
the asyncio loop Scrapling uses internally and the previous prototype
showed that doesn't scale.
"""
from __future__ import annotations

import os
import time
from typing import Any

from .parser import extract_stories

SITE_URL = "https://storysaver.net/"
DEFAULT_FETCH_TIMEOUT_MS = 120_000
RESULT_POLL_DEADLINE_SEC = 60
RESULT_POLL_INTERVAL_MS = 1500


def _build_page_action(handle: str):
    """Return a closure used as Scrapling's ``page_action`` callback.

    Scrapling spawns the page in a private event loop, so the callback runs
    inside that loop with a Playwright sync-style ``page`` proxy. We avoid
    nonlocal state — everything we need is captured via ``handle``.
    """

    def page_action(page: Any) -> Any:
        try:
            page.wait_for_load_state("domcontentloaded", timeout=30_000)
        except Exception:
            pass

        # Let the homepage render and stabilize.
        try:
            page.wait_for_timeout(2_000)
        except Exception:
            pass

        # Fill the username input — try a list of likely selectors.
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

        # Submit the form.
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

        # Poll for results — Turnstile is auto-solved by Scrapling stealth.
        # We DO NOT short-circuit on "private", "no story", etc. because
        # storysaver injects these strings (or generic "Connection error")
        # for both transient failures *and* genuine no-result cases. Caller
        # will see an empty parse and treat that as "no stories".
        deadline = time.time() + RESULT_POLL_DEADLINE_SEC
        last_content = ""
        found = False
        while time.time() < deadline:
            try:
                last_content = page.content()
            except Exception:
                break
            if "cdninstagram.com" in last_content:
                found = True
                break
            try:
                page.wait_for_timeout(RESULT_POLL_INTERVAL_MS)
            except Exception:
                break

        # Diagnostic line — print why we exited the poll loop so the
        # parent log shows whether the failure was a Turnstile timeout,
        # a genuine "no stories" case, or storysaver's transient error.
        if not found:
            html_lower = last_content.lower()
            tags: list[str] = []
            if "turnstile" in html_lower or "challenges.cloudflare.com" in html_lower:
                tags.append("turnstile-still-present")
            if "private" in html_lower:
                tags.append("private")
            if "no story" in html_lower or "no-story" in html_lower:
                tags.append("no-story")
            if "connection error" in html_lower:
                tags.append("connection-error")
            if "user not found" in html_lower or "not found" in html_lower:
                tags.append("not-found")
            if "captcha" in html_lower:
                tags.append("captcha")
            if not tags:
                tags.append("unknown")
            # Trim a snippet of #sonucc (the result container) so we can
            # see what storysaver actually rendered there.
            sonucc_idx = last_content.find('id="sonucc"')
            if sonucc_idx >= 0:
                snippet = last_content[sonucc_idx : sonucc_idx + 600].replace("\n", " ")
            else:
                snippet = last_content[:300].replace("\n", " ")
            print(
                f"[storysaver] handle={handle} no-cdn-after-poll tags={','.join(tags)} "
                f"len={len(last_content)} snippet={snippet!r}",
                flush=True,
            )
        return page

    return page_action


def fetch_stories(handle: str) -> list[dict[str, str | None]]:
    """Scrape the live storysaver result page and return parsed records.

    Returns an empty list when storysaver does not surface stories (private
    profile, no active stories, account deleted, etc.). Raises only when
    the browser/network layer fails — those errors must propagate so the
    parent worker can record the spot as errored without flagging the spot
    as cleanly "no stories".
    """
    # Import at call time so subprocess workers initialize their own loop.
    from scrapling.fetchers import StealthyFetcher

    timeout_ms = int(os.getenv("STORYSAVER_TIMEOUT_MS", DEFAULT_FETCH_TIMEOUT_MS))
    resp = StealthyFetcher.fetch(
        SITE_URL,
        headless=True,
        solve_cloudflare=False,  # see module docstring — the form, not the page
        network_idle=True,
        timeout=timeout_ms,
        wait=2_000,
        page_action=_build_page_action(handle),
        google_search=True,
        block_ads=True,
        # disable_resources kept off — when we tried True on the 2 GB
        # Standard plan every spot returned 0 stories: Scrapling was
        # also blocking CSS/JS that storysaver and the Turnstile widget
        # need to render the form and reach the result page. Memory
        # pressure is fine on Standard so we don't need the trade-off.
        disable_resources=False,
    )
    # Scrapling's Response.body is a bytes payload (the post-action HTML
    # when content-type is HTML). Decode robustly.
    body = getattr(resp, "body", None)
    html: str
    if isinstance(body, bytes):
        encoding = getattr(resp, "encoding", "") or "utf-8"
        try:
            html = body.decode(encoding, errors="replace")
        except LookupError:
            html = body.decode("utf-8", errors="replace")
    elif isinstance(body, str):
        html = body
    else:
        # Final fallback — Response exposes .html_content as a string.
        html = getattr(resp, "html_content", "") or ""
    if not html:
        return []
    return extract_stories(html)

"""storiesig.info 기반 IG 스토리 수집 (storysaver Turnstile 대체).

브라우저(Scrapling, headless)로 storiesig.info를 구동하면 사이트가 서명된
`POST https://api-wh.storiesig.info/api/v1/instagram/stories` 를 호출한다. 그 JSON 응답을
page.on("response")로 가로채 IG 비공개 API 포맷 items를 얻는다. Turnstile/캡차 없음.

행 매핑은 src/app/api/cron/scrape/route.ts 의 fetchStories 를 그대로 미러 →
기존 `stories` 테이블 행 구조 100% 동일.

배경/여정: scripts/SCRAPER_FIX_JOURNEY.md
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any

SITE = "https://storiesig.info/en/"
STORIES_MARK = "/api/v1/instagram/stories"
DEFAULT_TIMEOUT_MS = 90_000
RESULT_POLL_DEADLINE_SEC = 45

USER_SELECTORS = [
    'input[type="text"]',
    'input[name="username"]',
    'input[placeholder*="user" i]',
    'input[type="search"]',
    "input",
]
SUBMIT_SELECTORS = [
    'button[type="submit"]',
    'button:has-text("Search")',
    'button:has-text("Download")',
    "form button",
]


def _build_action(handle: str, captured: list[str]):
    # storiesig는 입력칸에 'instagram.com/stories/{handle}' 형태를 넣어야 stories 엔드포인트를 호출.
    query = f"https://www.instagram.com/stories/{handle}"

    def action(page: Any) -> Any:
        def on_response(r):
            try:
                if STORIES_MARK in r.url:
                    captured.append(r.text())
            except Exception:
                pass

        page.on("response", on_response)

        try:
            page.wait_for_load_state("domcontentloaded", timeout=30_000)
        except Exception:
            pass
        page.wait_for_timeout(2_500)

        for sel in USER_SELECTORS:
            try:
                el = page.query_selector(sel)
                if el and el.is_visible():
                    el.click()
                    el.fill(query)
                    break
            except Exception:
                continue

        page.wait_for_timeout(1_500)
        clicked = False
        for sel in SUBMIT_SELECTORS:
            try:
                b = page.query_selector(sel)
                if b and b.is_visible():
                    b.click()
                    clicked = True
                    break
            except Exception:
                continue
        if not clicked:
            try:
                page.keyboard.press("Enter")
            except Exception:
                pass

        deadline = time.time() + RESULT_POLL_DEADLINE_SEC
        while time.time() < deadline:
            if captured:
                break
            page.wait_for_timeout(1_500)
        # 세션 재사용 시 리스너 누적 방지
        try:
            page.remove_listener("response", on_response)
        except Exception:
            pass
        return page

    return action


def fetch_stories_items(handle: str) -> list[dict[str, Any]]:
    """storiesig를 구동해 stories 응답 JSON의 result(items) 리스트를 반환.

    스토리 없음/죽은 핸들이면 빈 리스트. 브라우저/네트워크 실패는 예외로 전파(상위에서 errored 처리)."""
    from scrapling.fetchers import StealthyFetcher

    captured: list[str] = []
    timeout_ms = int(os.getenv("STORIESIG_TIMEOUT_MS", DEFAULT_TIMEOUT_MS))
    StealthyFetcher.fetch(
        SITE,
        headless=True,
        network_idle=True,
        timeout=timeout_ms,
        wait=2_000,
        page_action=_build_action(handle, captured),
        block_ads=True,
        disable_resources=False,
    )
    return _parse_items(captured)


def _parse_items(captured: list[str]) -> list[dict[str, Any]]:
    """캡처된 응답들 중 stories result(items) 리스트 반환. 없으면 [] (죽은 핸들/무스토리)."""
    for body in captured:
        try:
            data = json.loads(body)
        except Exception:
            continue
        res = data.get("result")
        if isinstance(res, list):
            return res
    return []


def make_session(proxy: str | None = None):
    """재사용 가능한 스텔스 브라우저 세션. 워커가 spot 여러 개를 '브라우저 1개'로
    처리하기 위함(부팅 1회 → 속도·RAM·IP 모두 개선). with 문으로 열고 닫는다.

    proxy: "http://user:pass@host:port" 형식. None이면 STORIESIG_PROXY 환경변수를
    쓰고, 그것도 없으면 프록시 없이(로컬 IP) 동작 — 기존 동작 100% 보존."""
    from scrapling.fetchers import StealthySession

    timeout_ms = int(os.getenv("STORIESIG_TIMEOUT_MS", DEFAULT_TIMEOUT_MS))
    proxy = proxy or os.getenv("STORIESIG_PROXY") or None
    kwargs: dict[str, Any] = dict(
        headless=True,
        block_ads=True,
        disable_resources=False,
        network_idle=True,
        timeout=timeout_ms,
        wait=2_000,
    )
    if proxy:
        kwargs["proxy"] = proxy
    return StealthySession(**kwargs)


def fetch_stories_items_session(session, handle: str) -> list[dict[str, Any]]:
    """이미 열린 session으로 한 handle의 stories items 반환 (브라우저 재사용)."""
    captured: list[str] = []
    session.fetch(SITE, page_action=_build_action(handle, captured))
    return _parse_items(captured)


def build_rows(
    items: list[dict[str, Any]],
    *,
    spot_id: str,
    instagram_handle: str,
    fetch_time: datetime,
) -> list[dict[str, Any]]:
    """IG-포맷 story items → stories 행. cron/scrape route.ts 의 fetchStories 미러."""
    rows: list[dict[str, Any]] = []
    for item in items:
        pk = item.get("pk") or item.get("id")
        if not pk:
            continue
        videos = item.get("video_versions") or []
        candidates = (item.get("image_versions2") or {}).get("candidates") or []
        if videos:
            media_url = videos[0].get("url")
            media_type = "video"
            thumbnail_url = candidates[0].get("url") if candidates else None
        elif candidates:
            media_url = candidates[0].get("url")
            media_type = "image"
            thumbnail_url = None
        else:
            continue
        if not media_url:
            continue
        taken_at = item.get("taken_at")
        posted_at = (
            datetime.fromtimestamp(int(taken_at), tz=timezone.utc)
            if taken_at
            else fetch_time
        )
        rows.append(
            {
                "spot_id": spot_id,
                "instagram_id": instagram_handle,
                "instagram_media_id": str(pk),
                "media_url": media_url,
                "media_type": media_type,
                "thumbnail_url": thumbnail_url,
                "posted_at": posted_at.isoformat(),
                "expires_at": (posted_at + timedelta(hours=24)).isoformat(),
                "scraped_at": fetch_time.isoformat(),
            }
        )
    return rows


if __name__ == "__main__":
    # print-only 검증 (DB 미기록): worker_venv\Scripts\python.exe -m worker.storiesig_client instagram
    import sys

    if __package__ in (None, ""):
        sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

    handle = sys.argv[1] if len(sys.argv) > 1 else "instagram"
    t0 = time.time()
    print(f"[storiesig_client] fetching @{handle} ...")
    items = fetch_stories_items(handle)
    print(f"[storiesig_client] items={len(items)} in {time.time()-t0:.1f}s")
    rows = build_rows(
        items, spot_id="TEST-NO-DB", instagram_handle=handle, fetch_time=datetime.now(timezone.utc)
    )
    print(f"[storiesig_client] rows (NOT written to DB)={len(rows)}")
    for i, r in enumerate(rows):
        print(f"  row[{i}] {json.dumps(r, ensure_ascii=False)[:240]}")

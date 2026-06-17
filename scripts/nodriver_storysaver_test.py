# ── [스크래퍼 복구 여정 · DEAD END] ───────────────────────────────────────
# nodriver로 storysaver의 Cloudflare Turnstile 통과 시도 → 실패(위젯 못 풂).
# 보존용(실행 가능). 전체 맥락: scripts/SCRAPER_FIX_JOURNEY.md
# ──────────────────────────────────────────────────────────────────────────
"""nodriver 실험: storysaver Turnstile 통과 시도 (DB 절대 미기록).

기존 스크래퍼와 '똑같은 구조'를 보장하려고 파싱/행생성은 우리 코드를 그대로
재사용한다 (추측 금지):
  worker.scrape_adaptive._extract_stories_v2  (HTML -> records)
  worker.scrape._build_story_row              (record -> stories row)
DB 쓰기(upsert) 없음. 결과만 출력해서 (1) Turnstile 통과했는지 (2) 우리 파서로
같은 구조의 행이 나오는지 확인하는 용도.

사용:
  worker_venv\\Scripts\\python.exe scripts\\nodriver_storysaver_test.py chae_jeju
  worker_venv\\Scripts\\python.exe scripts\\nodriver_storysaver_test.py chae_jeju --headless
"""
from __future__ import annotations

import os
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import nodriver as uc  # noqa: E402
from worker.scrape_adaptive import _extract_stories_v2  # noqa: E402
from worker.scrape import _build_story_row  # noqa: E402

SITE_URL = "https://storysaver.net/"
USER_SELECTORS = [
    'input[name="username"]',
    'input[id="username"]',
    'input[type="text"]',
    'input[placeholder*="user" i]',
]
SUBMIT_SELECTORS = [
    'input[type="submit"]',
    'button[type="submit"]',
    "#submit",
    "button.btn",
]


async def _fetch_html(handle: str, *, headless: bool) -> str:
    browser = await uc.start(headless=headless)
    try:
        page = await browser.get(SITE_URL)
        await page.sleep(3)

        # username 입력
        for sel in USER_SELECTORS:
            try:
                el = await page.select(sel, timeout=4)
            except Exception:
                el = None
            if el:
                await el.send_keys(handle)
                print(f"[nodriver] filled username via {sel}")
                break

        # 제출 (셀렉터 → 텍스트 매칭 순)
        clicked = False
        for sel in SUBMIT_SELECTORS:
            try:
                btn = await page.select(sel, timeout=3)
            except Exception:
                btn = None
            if btn:
                await btn.click()
                clicked = True
                print(f"[nodriver] clicked submit via {sel}")
                break
        if not clicked:
            for label in ("Download", "Submit", "Search"):
                try:
                    btn = await page.find(label, best_match=True, timeout=3)
                except Exception:
                    btn = None
                if btn:
                    await btn.click()
                    clicked = True
                    print(f"[nodriver] clicked submit via text='{label}'")
                    break

        # 결과 폴링: Turnstile 자동 해결 + 결과(cdn url) 렌더 대기
        deadline = time.time() + 75
        html = ""
        while time.time() < deadline:
            await page.sleep(2)
            html = await page.get_content()
            if "cdninstagram.com" in html or "get-cdn-image" in html:
                print("[nodriver] ✅ result detected (cdn url present)")
                break
        return await page.get_content()
    finally:
        try:
            browser.stop()
        except Exception:
            pass


def main() -> int:
    handle = next((a for a in sys.argv[1:] if not a.startswith("--")), "chae_jeju")
    headless = "--headless" in sys.argv
    print(f"[nodriver] fetching @{handle} (headless={headless})")
    t0 = time.time()
    html = uc.loop().run_until_complete(_fetch_html(handle, headless=headless))
    dur = time.time() - t0
    print(f"[nodriver] got {len(html)} bytes in {dur:.1f}s")

    turnstile = "challenges.cloudflare.com/turnstile" in html
    cdn = ("cdninstagram.com" in html) or ("get-cdn-image" in html)
    print(f"[nodriver] turnstile_widget_present={turnstile}  cdn_present={cdn}")

    # === 기존 파서/행생성 재사용 (구조 동일 보장) · DB 쓰기 없음 ===
    records = _extract_stories_v2(html)
    print(f"[nodriver] parsed {len(records)} records")
    for i, r in enumerate(records[:5]):
        print(f"  rec[{i}] {r}")

    ft = datetime.now(timezone.utc)
    rows = [
        _build_story_row(spot_id="TEST-NO-DB", instagram_handle=handle, record=r, fetch_time=ft)
        for r in records
    ]
    rows = [r for r in rows if r is not None]
    print(f"[nodriver] would-be DB rows (NOT written): {len(rows)}")
    for i, row in enumerate(rows[:3]):
        print(f"  row[{i}] {row}")
    return 0 if rows else 1


if __name__ == "__main__":
    sys.exit(main())

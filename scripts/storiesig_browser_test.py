# ── [스크래퍼 복구 여정 · 5단계 · WINNER ✅] ──────────────────────────────
# 브라우저로 storiesig 구동 → 사이트가 서명한 /api/v1/instagram/stories 호출을
# page.on("response")로 가로채 JSON(cdninstagram URL) 획득 성공. Turnstile/캡차 없음.
# 이게 채택된 방식. 다음: worker/storiesig_client.py로 구현 + 워커 통합.
# 전체 맥락: scripts/SCRAPER_FIX_JOURNEY.md
# ──────────────────────────────────────────────────────────────────────────
"""storiesig.info 브라우저 구동 + 네트워크 응답 가로채기 실험 (읽기 전용, DB 미접근).

storiesig는 Turnstile이 없어 Scrapling으로 충분. 사이트가 호출하는 /api/v1/instagram/*
XHR 응답을 page.on("response")로 직접 캡처해서, 스토리 JSON 구조를 확인한다.

사용: worker_venv\\Scripts\\python.exe scripts\\storiesig_browser_test.py chae_jeju
"""
from __future__ import annotations

import re
import sys
import time

SITE = "https://storiesig.info/en/"
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
SUGGESTION_SELECTORS = [
    '[class*="suggestion"] a',
    '[class*="suggestion"] li',
    "ul li a",
    ".dropdown a",
]


def _build_action(handle: str):
    captured: list[tuple[str, int, str]] = []

    def action(page):
        def on_response(r):
            try:
                if "/api/v1/instagram/" in r.url or "/api/convert" in r.url:
                    try:
                        body = r.text()
                    except Exception as e:
                        body = f"<body read failed: {e}>"
                    captured.append((r.url, r.status, body))
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
                    el.fill(f"https://www.instagram.com/stories/{handle}")
                    print(f"[storiesig] filled stories-URL for {handle} via {sel}", flush=True)
                    break
            except Exception:
                continue

        page.wait_for_timeout(2_500)  # 검색 제안 로드 대기

        done = False
        for sel in SUGGESTION_SELECTORS:
            try:
                s = page.query_selector(sel)
                if s and s.is_visible():
                    s.click()
                    done = True
                    print(f"[storiesig] clicked suggestion {sel}", flush=True)
                    break
            except Exception:
                continue
        if not done:
            for sel in SUBMIT_SELECTORS:
                try:
                    b = page.query_selector(sel)
                    if b and b.is_visible():
                        b.click()
                        done = True
                        print(f"[storiesig] clicked submit {sel}", flush=True)
                        break
                except Exception:
                    continue
        if not done:
            try:
                page.keyboard.press("Enter")
                print("[storiesig] pressed Enter", flush=True)
            except Exception:
                pass

        deadline = time.time() + 45
        while time.time() < deadline:
            c = page.content()
            if "cdninstagram.com" in c or "get-cdn-image" in c:
                break
            if any(("/instagram/stories" in u) or ("/instagram/userInfo" in u) for u, _, _ in captured):
                page.wait_for_timeout(3_000)
                break
            page.wait_for_timeout(1_500)

        # === 결과는 action 내부에서 출력 (Scrapling 내부 루프 경계 문제 회피) ===
        import json as _json
        print(f"\n[storiesig] === captured {len(captured)} api responses ===", flush=True)
        for u, st, body in captured:
            print(f"  [{st}] {u}  (len={len(body)})", flush=True)
            if "/instagram/stories" in u:
                try:
                    items = (_json.loads(body) or {}).get("result") or []
                    print(f"      stories items: {len(items)}", flush=True)
                    if items:
                        print(f"      FIRST ITEM KEYS: {list(items[0].keys())}", flush=True)
                        print(f"      FIRST ITEM: {_json.dumps(items[0], ensure_ascii=False)[:2600]}", flush=True)
                except Exception as e:
                    print(f"      (parse failed: {e}) head: {body[:400]!r}", flush=True)
            else:
                print(f"      body: {body[:300]!r}", flush=True)
        try:
            print(f"\n[storiesig] DOM tail: {page.content()[-700:]!r}", flush=True)
        except Exception:
            pass
        return page

    return action


def main() -> int:
    handle = next((a for a in sys.argv[1:] if not a.startswith("--")), "chae_jeju")
    headless = "--headless" in sys.argv
    from scrapling.fetchers import StealthyFetcher

    print(f"[storiesig] fetching @{handle} (headless={headless})")
    t0 = time.time()
    resp = StealthyFetcher.fetch(
        SITE,
        headless=headless,
        network_idle=True,
        timeout=90_000,
        wait=2_000,
        page_action=_build_action(handle),
        block_ads=True,
        disable_resources=False,
    )
    body = getattr(resp, "body", None)
    html = body.decode("utf-8", "replace") if isinstance(body, bytes) else (body or getattr(resp, "html_content", "") or "")
    print(f"\n[storiesig] done in {time.time()-t0:.1f}s, final html {len(html)} bytes")
    cdn = re.findall(r'https?://[^\s"\'<>]*(?:cdninstagram\.com|fbcdn\.net)[^\s"\'<>]*', html)
    print(f"[storiesig] cdn urls in final DOM: {len(cdn)}")
    return 0


if __name__ == "__main__":
    main()

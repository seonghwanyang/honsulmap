# ── [스크래퍼 복구 여정 · 3단계] ──────────────────────────────────────────
# 라이브 사이트 JS를 grep해 현재 API 경로 prefix `/api/v1/instagram/` 발견.
# 전체 맥락: scripts/SCRAPER_FIX_JOURNEY.md
# ──────────────────────────────────────────────────────────────────────────
"""StoriesIG(및 자매 사이트)의 '현재' API 엔드포인트 자동 발견 (읽기 전용, DB 미접근).

라이브 사이트 HTML + JS 번들을 받아서 api 호스트 / `/api/...` 경로 패턴을 grep.
사용: worker_venv\\Scripts\\python.exe scripts\\storiesig_discover.py
"""
import re
import sys
import urllib.parse as up
import urllib.request

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,*/*",
}

SITES = [
    "https://storiesig.info/en/",
    "https://www.instanavigation.com/",
    "https://anonyig.com/en/",
]


def get(url: str):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.status, r.read().decode("utf-8", "replace")


API_HOST_RE = re.compile(r"https?://[a-zA-Z0-9.\-]*api[a-zA-Z0-9.\-]*\.[a-z]{2,}")
API_PATH_RE = re.compile(r"""["'`](/api/[A-Za-z0-9_\-/]+)""")


def scan(site: str):
    print(f"\n===== {site} =====")
    try:
        st, html = get(site)
    except Exception as e:
        print(f"  home FAILED {type(e).__name__}: {e}")
        return
    cf = ("challenges.cloudflare.com" in html) or ("Just a moment" in html)
    print(f"  home status={st} len={len(html)} cloudflare={cf}")
    print(f"  html api-hosts: {sorted(set(API_HOST_RE.findall(html)))[:8]}")
    print(f"  html api-paths: {sorted(set(m for m in API_PATH_RE.findall(html)))[:12]}")

    srcs = re.findall(r'<script[^>]+src="([^"]+)"', html)
    print(f"  scripts: {len(srcs)}")
    checked = 0
    for s in srcs:
        full = up.urljoin(site, s)
        if not full.startswith("http"):
            continue
        try:
            _, js = get(full)
        except Exception:
            continue
        hosts = sorted(set(API_HOST_RE.findall(js)))
        paths = sorted(set(API_PATH_RE.findall(js)))
        if hosts or paths:
            print(f"  [JS ...{full[-48:]}] hosts={hosts[:6]} paths={paths[:20]}")
        checked += 1
        if checked >= 15:
            break


def main() -> int:
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for site in SITES:
        if only and only not in site:
            continue
        scan(site)
    return 0


if __name__ == "__main__":
    main()

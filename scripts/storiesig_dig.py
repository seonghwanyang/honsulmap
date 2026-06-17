# ── [스크래퍼 복구 여정 · 4단계] ──────────────────────────────────────────
# app.js 정밀 분석 → 호스트 api-wh.storiesig.info, 엔드포인트(stories/userInfo/posts),
# 보호=whToken(자체 이미지캡차)+서명된 body 구조 파악. 전체: scripts/SCRAPER_FIX_JOURNEY.md
# ──────────────────────────────────────────────────────────────────────────
"""storiesig app.js를 파서 stories API의 전체 경로/파라미터/베이스 호스트를 추출.
읽기 전용, DB 미접근.
사용: worker_venv\\Scripts\\python.exe scripts\\storiesig_dig.py
"""
import re
import urllib.parse as up
import urllib.request

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
    ),
}


def get(url: str):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read().decode("utf-8", "replace")


SITE = "https://storiesig.info/en/"
TOKENS = [
    "workerHubDomain",
    "endpoint:",
    "whToken",
    "signature",
    "signRequest",
    "subscribeSignedRequestBody",
    "fetchInstagramApi(",
    "x-",
]


def main() -> int:
    html = get(SITE)
    srcs = re.findall(r'<script[^>]+src="([^"]+)"', html)
    appjs = None
    for s in srcs:
        if "app.js" in s:
            appjs = up.urljoin(SITE, s)
            break
    if not appjs:
        print("app.js not found; scripts:", srcs)
        return 1
    js = get(appjs)
    print(f"app.js: {appjs}\nlen={len(js)}\n")

    for tok in TOKENS:
        idxs = [m.start() for m in re.finditer(re.escape(tok), js)]
        print(f"== {tok} ({len(idxs)} hits) ==")
        for i in idxs[:4]:
            print("   ", repr(js[max(0, i - 130): i + 170]))
        print()
    return 0


if __name__ == "__main__":
    main()

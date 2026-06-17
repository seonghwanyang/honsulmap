# ── [스크래퍼 복구 여정 · 2단계] ──────────────────────────────────────────
# 옛 fabula 레포의 api-ig 경로 직접 GET → 404(경로 폐기됨). 현재 경로는
# /api/v1/instagram/ (storiesig_discover.py 참고). 전체: scripts/SCRAPER_FIX_JOURNEY.md
# ──────────────────────────────────────────────────────────────────────────
"""StoriesIG 비공인 JSON API 라이브 검증 (읽기 전용, DB 절대 미접근).

리서치가 찾은 무-Turnstile 대안 소스:
  GET https://api-ig.storiesig.info/api/userInfoByUsername/{handle}
  GET https://api-ig.storiesig.info/api/story?url=https://www.instagram.com/stories/{handle}
응답 JSON에 video_versions / image_versions2 (cdninstagram URL)가 있는지 확인용.

사용: worker_venv\\Scripts\\python.exe scripts\\storiesig_api_probe.py chae_jeju
"""
import json
import sys

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36"
    ),
    "Referer": "https://storiesig.info/",
    "Accept": "application/json",
}
BASE = "https://api-ig.storiesig.info"

try:
    import requests  # type: ignore

    def get(url: str):
        r = requests.get(url, headers=HEADERS, timeout=25)
        return r.status_code, r.text
except Exception:
    import urllib.request

    def get(url: str):
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=25) as resp:
            return resp.status, resp.read().decode("utf-8", "replace")


def probe(label: str, url: str):
    print(f"\n[probe] {label}: {url}")
    try:
        st, body = get(url)
    except Exception as e:
        print(f"[probe] {label} FAILED {type(e).__name__}: {e}")
        return None
    cdn = ("cdninstagram.com" in body) or ("fbcdn.net" in body)
    print(f"[probe] {label} status={st} len={len(body)} has_cdn_url={cdn}")
    try:
        data = json.loads(body)
        if isinstance(data, dict):
            print(f"[probe] {label} top-level keys: {list(data.keys())}")
        return data
    except Exception:
        print(f"[probe] {label} (non-JSON) snippet: {body[:300]!r}")
        return None


def main() -> int:
    handle = sys.argv[1] if len(sys.argv) > 1 else "chae_jeju"
    print(f"[probe] handle=@{handle}")

    probe("userInfoByUsername", f"{BASE}/api/userInfoByUsername/{handle}")

    data = probe(
        "story",
        f"{BASE}/api/story?url=https://www.instagram.com/stories/{handle}",
    )
    if isinstance(data, dict):
        # 구조 탐색: items / result 안에서 미디어 URL 후보 찾기
        print(f"[probe] story full (first 900 chars): {json.dumps(data, ensure_ascii=False)[:900]}")
    return 0


if __name__ == "__main__":
    main()

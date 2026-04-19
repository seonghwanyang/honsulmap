"""
3개 남은 가게 최종 복구 — 각 가게 fresh context, region 일치 강제.
"""
import os, sys, io, time
from urllib.parse import quote
from dotenv import load_dotenv
from supabase import create_client
from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
load_dotenv(".env.local")
sb = create_client(os.environ["NEXT_PUBLIC_SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])

# 이미 Playwright 로그에서 확인된 정답
VERIFIED = {
    "제주아홉(금능)": {
        "naver_place_id": "1099583672",
        # 좌표/주소는 이미 맞음, placeId만 복구
    },
}

# Playwright 재시도 대상 (region 제약까지)
RETRY = {
    "바티(Bar T)": {"expected_region_keyword": "서귀포"},       # seed: seogwipo
    "첫선 제주애월 와인바": {"expected_region_keyword": "애월"}, # seed: aewol
}


def search_fresh(browser, query: str, timeout=45000):
    """fresh context + 단일 쿼리 → 첫 allSearch 응답만 캡처"""
    ctx = browser.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale="ko-KR",
        viewport={"width": 1280, "height": 800},
    )
    page = ctx.new_page()
    captured = []

    def on_resp(resp):
        if "/api/search/allSearch" in resp.url and "query=" in resp.url:
            try:
                data = resp.json()
                places = (data.get("result") or {}).get("place") or {}
                items = places.get("list") or []
                captured.extend(items)
            except Exception:
                pass

    page.on("response", on_resp)
    try:
        page.goto(f"https://map.naver.com/p/search/{quote(query)}", wait_until="networkidle", timeout=timeout)
    except Exception as e:
        print(f"    goto error: {e}")
    time.sleep(2)
    ctx.close()
    return captured


def main():
    # 1) 제주아홉(금능) placeId 복구
    print("=== 제주아홉(금능) placeId 복구 ===")
    sb.table("spots").update(VERIFIED["제주아홉(금능)"]).eq("name", "제주아홉(금능)").execute()
    print(f"  ✓ naver_place_id = 1099583672")

    # 2) 바티, 첫선 Playwright 재시도
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # 워밍업
        ctx0 = browser.new_context(locale="ko-KR")
        page0 = ctx0.new_page()
        page0.goto("https://map.naver.com/", wait_until="networkidle", timeout=30000)
        time.sleep(2)
        ctx0.close()

        for name, meta in RETRY.items():
            print(f"\n=== {name} (region filter: {meta['expected_region_keyword']}) ===")
            queries = [name, name.split("(")[0].strip() + " 제주", name.replace(" ", "")]
            for q in queries:
                items = search_fresh(browser, q)
                print(f"  쿼리 '{q}' → {len(items)} hits")
                for it in items[:5]:
                    nm = it.get("name", "")
                    addr = it.get("roadAddress") or it.get("address", "")
                    pid = it.get("id")
                    try:
                        x, y = float(it.get("x")), float(it.get("y"))
                    except Exception:
                        continue
                    in_jeju = 33.1 <= y <= 33.6 and 126.1 <= x <= 127.0
                    region_ok = meta["expected_region_keyword"] in addr
                    mark = "✓" if (in_jeju and region_ok) else "✗"
                    print(f"    {mark} {nm} | {addr} | id={pid} | ({y},{x})")
                    if in_jeju and region_ok:
                        sb.table("spots").update({
                            "naver_place_id": str(pid),
                            "lat": round(y, 6), "lng": round(x, 6),
                            "address": addr,
                        }).eq("name", name).execute()
                        print(f"      → 업데이트 완료")
                        break
                else:
                    continue
                break
            time.sleep(3)
        browser.close()

    # 3) 최종 상태
    print("\n=== 최종 상태 ===")
    rows = sb.table("spots").select("name, address, naver_place_id").order("name").execute().data
    null_pid = [r for r in rows if not r.get("naver_place_id")]
    print(f"총 {len(rows)}개, placeId 없음 {len(null_pid)}개")
    for r in null_pid:
        print(f"  - {r['name']} | {r.get('address','')}")


if __name__ == "__main__":
    main()

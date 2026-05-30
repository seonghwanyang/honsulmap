"""
부산 spots만 골라서 map.naver.com 내부 API로 재수집.
- naver_map_resync_seoul.py의 부산 버전. 좌표 범위 + 지역 쿼리만 다름.
- city='busan' AND naver_place_id IS NULL 인 행만 타겟.
- Playwright로 실제 브라우저 세션 사용, allSearch 응답 가로채서
  placeId + 좌표 + 도로명 주소 추출 후 DB 업데이트.
"""
import os, sys, io, time, random, logging
from urllib.parse import quote
from dotenv import load_dotenv
from supabase import create_client
from playwright.sync_api import sync_playwright

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
load_dotenv(".env.local")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s",
                    handlers=[logging.StreamHandler(sys.stdout)])
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

# 부산 구 → 검색 쿼리 보조어 (가게명에 더해서 검색하면 매칭 정확도 ↑).
# 우리가 데이터를 가진 구만 채우면 충분 — 나머지는 '부산' 폴백.
REGION_HINT = {
    "busan_suyeong":  "광안리",
    "busan_busanjin": "서면",
    "busan_haeundae": "해운대",
    "busan_jung":     "부산 중구",
    "busan_nam":      "부산 남구",
    "busan_dongnae":  "동래",
    "busan_yeonje":   "연제",
}

# Busan lat/lng bounds (생활권 + 기장군까지 여유)
LAT_MIN, LAT_MAX = 35.00, 35.40
LNG_MIN, LNG_MAX = 128.80, 129.35


def pick_best(places, name: str):
    """부산 좌표 범위 + 이름 유사도 기반"""
    nm = name.replace(" ", "").lower()
    best = None
    for p in places:
        try:
            x = float(p.get("x"))
            y = float(p.get("y"))
        except Exception:
            continue
        if not (LAT_MIN <= y <= LAT_MAX and LNG_MIN <= x <= LNG_MAX):
            continue
        title = (p.get("name") or "").replace(" ", "").lower()
        if nm == title:
            sc = 100
        elif nm in title or title in nm:
            sc = 70
        else:
            common = set(nm) & set(title)
            sc = int(len(common) / max(len(set(nm)), len(set(title))) * 50) if common else 0
        if best is None or sc > best[0]:
            best = (sc, p, y, x)
    return best


def search_one(page, query: str, timeout=40000):
    captured = []

    def on_resp(resp):
        if "/api/search/allSearch" not in resp.url:
            return
        try:
            data = resp.json()
            res = (data.get("result") or {}).get("place") or {}
            items = res.get("list") or []
            captured.extend(items)
        except Exception:
            pass

    page.on("response", on_resp)
    try:
        page.goto(f"https://map.naver.com/p/search/{quote(query)}",
                  wait_until="networkidle", timeout=timeout)
    except Exception as e:
        log.warning(f"    goto error: {e}")
    time.sleep(2)
    page.remove_listener("response", on_resp)
    return captured


def main():
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    rows = (
        sb.table("spots")
        .select("id, name, region, lat, lng, address, naver_place_id, city")
        .eq("city", "busan")
        .execute()
        .data
        or []
    )
    targets = [r for r in rows if not r.get("naver_place_id")]
    log.info(f"부산 전체 {len(rows)}개, placeId 미수집 {len(targets)}개")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            locale="ko-KR",
            viewport={"width": 1280, "height": 800},
        )
        page = ctx.new_page()

        # 워밍업 — map.naver.com 홈 한 번 방문해서 세션 쿠키 세팅
        log.info("워밍업: map.naver.com 홈 방문")
        page.goto("https://map.naver.com/", wait_until="networkidle", timeout=30000)
        time.sleep(2)

        updated, failed = 0, []
        consecutive_empty = 0

        for i, r in enumerate(targets):
            name = r["name"]
            region = r.get("region", "")
            hint = REGION_HINT.get(region, "부산")
            # 검색 쿼리 우선순위: 가게명+지역힌트 → 가게명+부산 → 가게명 단독
            queries = [f"{name} {hint}", f"{name} 부산", name]

            log.info(f"[{i+1}/{len(targets)}] {name} (region={region})")

            best = None
            for q in queries:
                places = search_one(page, q)
                log.info(f"    '{q}' → {len(places)} hits")
                if places:
                    b = pick_best(places, name)
                    if b and (best is None or b[0] > best[0]):
                        best = b
                        if b[0] >= 70:
                            break
                time.sleep(random.uniform(3, 5))

            if not best:
                consecutive_empty += 1
                log.warning("    ✗ 매칭 없음")
                failed.append(name)
                if consecutive_empty >= 5:
                    log.warning("    5회 연속 실패 → throttling 의심. 60초 휴식")
                    time.sleep(60)
                    consecutive_empty = 0
                continue

            consecutive_empty = 0
            score, place, lat, lng = best
            pid = str(place.get("id", ""))
            addr = place.get("roadAddress") or place.get("address", "")
            nv_name = place.get("name", "")

            dist_km = ((lat - r["lat"]) ** 2 + (lng - r["lng"]) ** 2) ** 0.5 * 111
            log.info(f"    ✓ match: {nv_name} (id={pid}, score={score}) | {addr}")
            log.info(f"      ({lat:.6f},{lng:.6f}) Δ={dist_km:.2f}km from DB")

            update = {
                "naver_place_id": pid,
                "lat": round(lat, 6),
                "lng": round(lng, 6),
                "address": addr,
            }
            try:
                sb.table("spots").update(update).eq("id", r["id"]).execute()
                updated += 1
            except Exception as e:
                log.error(f"    DB update 실패: {e}")

            time.sleep(random.uniform(3, 5))

        browser.close()

        log.info("=" * 60)
        log.info(f"완료: 업데이트 {updated}, 실패 {len(failed)}")
        if failed:
            log.info(f"실패 목록: {failed}")


if __name__ == "__main__":
    main()

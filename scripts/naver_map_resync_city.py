"""
범용 Naver Map 재수집 — 도시 하나를 인자로 받아 그 도시의
naver_place_id 미수집 spot들의 placeId + 좌표 + 도로명 주소를 채운다.

  python scripts/naver_map_resync_city.py incheon
  python scripts/naver_map_resync_city.py daejeon gwangju daegu gyeonggi chungbuk jeonbuk

naver_map_resync_seoul.py / _busan.py 의 일반화 버전 (제주/서울/부산은
전용 스크립트가 이미 있음). CITY_CONFIG에 좌표 범위 + region 힌트만
추가하면 새 도시도 바로 처리된다.
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

# city → { bounds: (lat_min, lat_max, lng_min, lng_max), hint: 검색보조어,
#          region_hint: {region_code: 보조어} }
CITY_CONFIG = {
    "incheon":  {"bounds": (37.30, 37.60, 126.55, 126.80), "hint": "인천",
                 "region_hint": {"incheon_bupyeong": "부평", "incheon_namdong": "구월동"}},
    "daejeon":  {"bounds": (36.25, 36.45, 127.30, 127.50), "hint": "대전",
                 "region_hint": {"daejeon_seo": "둔산", "daejeon_yuseong": "봉명동"}},
    "gwangju":  {"bounds": (35.05, 35.25, 126.75, 126.95), "hint": "광주",
                 "region_hint": {"gwangju_seo": "화정동", "gwangju_dong": "동명동"}},
    "daegu":    {"bounds": (35.80, 35.95, 128.50, 128.70), "hint": "대구",
                 "region_hint": {"daegu_jung": "동성로"}},
    "gyeonggi": {"bounds": (37.20, 37.60, 126.70, 127.20), "hint": "경기",
                 "region_hint": {"gyeonggi_suwon": "수원", "gyeonggi_ansan": "안산",
                                 "gyeonggi_anyang": "안양", "gyeonggi_bucheon": "부천"}},
    "chungbuk": {"bounds": (36.55, 36.75, 127.40, 127.55), "hint": "청주",
                 "region_hint": {"chungbuk_cheongju": "청주"}},
    "jeonbuk":  {"bounds": (35.75, 35.90, 127.05, 127.25), "hint": "전주",
                 "region_hint": {"jeonbuk_jeonju": "전주"}},
}


def pick_best(places, name, bounds):
    lat_min, lat_max, lng_min, lng_max = bounds
    nm = name.replace(" ", "").lower()
    best = None
    for p in places:
        try:
            x = float(p.get("x")); y = float(p.get("y"))
        except Exception:
            continue
        if not (lat_min <= y <= lat_max and lng_min <= x <= lng_max):
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


def search_one(page, query, timeout=40000):
    captured = []

    def on_resp(resp):
        if "/api/search/allSearch" not in resp.url:
            return
        try:
            res = (resp.json().get("result") or {}).get("place") or {}
            captured.extend(res.get("list") or [])
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


def resync_city(sb, page, city):
    cfg = CITY_CONFIG[city]
    bounds, hint, region_hint = cfg["bounds"], cfg["hint"], cfg["region_hint"]
    rows = (sb.table("spots")
            .select("id, name, region, lat, lng, naver_place_id, city")
            .eq("city", city).execute().data or [])
    targets = [r for r in rows if not r.get("naver_place_id")]
    log.info(f"[{city}] 전체 {len(rows)}개, placeId 미수집 {len(targets)}개")

    updated, failed, consecutive_empty = 0, [], 0
    for i, r in enumerate(targets):
        name = r["name"]
        rhint = region_hint.get(r.get("region", ""), hint)
        queries = [f"{name} {rhint}", f"{name} {hint}", name]
        log.info(f"  [{i+1}/{len(targets)}] {name} (region={r.get('region')})")
        best = None
        for q in queries:
            places = search_one(page, q)
            log.info(f"      '{q}' → {len(places)} hits")
            if places:
                b = pick_best(places, name, bounds)
                if b and (best is None or b[0] > best[0]):
                    best = b
                    if b[0] >= 70:
                        break
            time.sleep(random.uniform(3, 5))
        if not best:
            consecutive_empty += 1
            log.warning("      ✗ 매칭 없음")
            failed.append(name)
            if consecutive_empty >= 5:
                log.warning("      5회 연속 실패 → 60초 휴식")
                time.sleep(60); consecutive_empty = 0
            continue
        consecutive_empty = 0
        score, place, lat, lng = best
        pid = str(place.get("id", ""))
        addr = place.get("roadAddress") or place.get("address", "")
        log.info(f"      ✓ {place.get('name')} (id={pid}, score={score}) | {addr}")
        try:
            sb.table("spots").update({
                "naver_place_id": pid, "lat": round(lat, 6),
                "lng": round(lng, 6), "address": addr,
            }).eq("id", r["id"]).execute()
            updated += 1
        except Exception as e:
            log.error(f"      DB update 실패: {e}")
        time.sleep(random.uniform(3, 5))
    log.info(f"[{city}] 완료: 업데이트 {updated}, 실패 {len(failed)} {failed}")
    return updated


def main():
    cities = sys.argv[1:]
    if not cities:
        print("usage: python naver_map_resync_city.py <city> [city2 ...]")
        print("       cities:", ", ".join(CITY_CONFIG.keys()))
        sys.exit(1)
    for c in cities:
        if c not in CITY_CONFIG:
            print(f"unknown city '{c}' — known:", ", ".join(CITY_CONFIG.keys()))
            sys.exit(1)

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            locale="ko-KR", viewport={"width": 1280, "height": 800})
        page = ctx.new_page()
        log.info("워밍업: map.naver.com 홈 방문")
        page.goto("https://map.naver.com/", wait_until="networkidle", timeout=30000)
        time.sleep(2)
        total = 0
        for c in cities:
            total += resync_city(sb, page, c)
        browser.close()
        log.info("=" * 60)
        log.info(f"전체 완료: 업데이트 {total}")


if __name__ == "__main__":
    main()

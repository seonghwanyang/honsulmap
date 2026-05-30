"""
70개 가게 전체를 map.naver.com 내부 API로 재수집.
- Playwright로 실제 브라우저 세션
- allSearch 응답 가로채서 placeId + 좌표 + 주소 추출
- DB에 naver_place_id 포함해서 업데이트
- throttling 회피: 4~6초 간격, 실패 시 재시도 + 긴 대기
"""
import os, sys, io, re, json, time, random, logging
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

REGION_MAP = {"jeju": "제주시", "aewol": "애월", "seogwipo": "서귀포", "east": "제주", "west": "제주"}

def pick_best(places, name: str):
    """제주 범위 + 이름 유사도 기반"""
    nm = name.replace(" ", "").lower()
    best = None
    for p in places:
        try:
            x = float(p.get("x"))
            y = float(p.get("y"))
        except Exception:
            continue
        if not (33.1 <= y <= 33.6 and 126.1 <= x <= 127.0):
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
    rows = sb.table("spots").select("id, name, region, lat, lng, address, naver_place_id").execute().data or []
    # placeId 아직 없는 것만 타겟 (이미 있는 건 건드리지 않음)
    targets = [r for r in rows if not r.get("naver_place_id")]
    log.info(f"전체 {len(rows)}개, placeId 미수집 {len(targets)}개")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            locale="ko-KR",
            viewport={"width": 1280, "height": 800},
        )
        page = ctx.new_page()

        # 워밍업 — 홈 먼저 한번 들렀다가
        log.info("워밍업: map.naver.com 홈 방문")
        page.goto("https://map.naver.com/", wait_until="networkidle", timeout=30000)
        time.sleep(2)

        updated, skipped, failed = 0, 0, []
        consecutive_empty = 0

        for i, r in enumerate(targets):
            name = r["name"]
            region = r.get("region", "")
            area = REGION_MAP.get(region, "제주")
            queries = [f"{name} {area}", f"{name} 제주", name]

            log.info(f"[{i+1}/{len(targets)}] {name} (region={region})")

            best = None
            used_q = None
            for q in queries:
                places = search_one(page, q)
                log.info(f"    '{q}' → {len(places)} hits")
                if places:
                    b = pick_best(places, name)
                    if b and (best is None or b[0] > best[0]):
                        best = b
                        used_q = q
                        if b[0] >= 70:
                            break  # 좋은 매칭이면 더 안 찾음
                # throttling 회피
                time.sleep(random.uniform(3, 5))

            if not best:
                consecutive_empty += 1
                log.warning(f"    ✗ 매칭 없음")
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

            # 기존 좌표랑 비교
            dist_km = ((lat - r["lat"])**2 + (lng - r["lng"])**2) ** 0.5 * 111
            log.info(f"    ✓ match: {nv_name} (id={pid}, score={score}) | {addr}")
            log.info(f"      ({lat:.6f},{lng:.6f}) Δ={dist_km:.2f}km from DB")

            update = {"naver_place_id": pid, "lat": round(lat, 6), "lng": round(lng, 6), "address": addr}
            try:
                sb.table("spots").update(update).eq("id", r["id"]).execute()
                updated += 1
            except Exception as e:
                log.error(f"    DB update 실패: {e}")

            # 다음 요청 전 간격
            time.sleep(random.uniform(3, 5))

        browser.close()

        log.info("=" * 60)
        log.info(f"완료: 업데이트 {updated}, 실패 {len(failed)}")
        if failed:
            log.info(f"실패 목록: {failed}")

if __name__ == "__main__":
    main()

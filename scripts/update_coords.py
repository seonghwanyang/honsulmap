"""
Naver Local Search API로 가게 검색 → KATECH 좌표를 WGS84로 변환 → DB 업데이트
Usage: python scripts/update_coords.py
"""

import os
import sys
import re
import time
import logging
import requests
from dotenv import load_dotenv
from supabase import create_client, Client as SupabaseClient

load_dotenv(".env.local")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

# ── Naver Developers (Local Search API) ──
SEARCH_CLIENT_ID = "mQgUkdWQOWSfr1rFb6d9"
SEARCH_CLIENT_SECRET = "eWR0ZJVkhd"

# ── Supabase ──
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

DELAY = 0.3  # API rate limit (초)


def init_supabase() -> SupabaseClient:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def parse_coords(mapx: str, mapy: str) -> tuple[float, float]:
    """Naver Local Search 좌표 (WGS84 * 10^7) → lat, lng"""
    lng = float(mapx) / 10_000_000
    lat = float(mapy) / 10_000_000
    return lat, lng


def search_local(name: str) -> dict | None:
    """Naver Local Search API로 가게 검색"""
    url = "https://openapi.naver.com/v1/search/local.json"
    headers = {
        "X-Naver-Client-Id": SEARCH_CLIENT_ID,
        "X-Naver-Client-Secret": SEARCH_CLIENT_SECRET,
    }
    params = {"query": f"{name} 제주", "display": 5}

    r = requests.get(url, headers=headers, params=params, timeout=10)
    if r.status_code != 200:
        log.warning(f"  Local Search 실패: {r.status_code} {r.text[:100]}")
        return None

    items = r.json().get("items", [])
    if not items:
        return None

    # 이름이 가장 비슷한 결과 선택 (HTML 태그 제거 후 비교)
    clean = lambda s: re.sub(r"<[^>]+>", "", s)
    best = items[0]
    for item in items:
        title = clean(item["title"])
        if name in title or title in name:
            best = item
            break

    return best


def extract_place_id(link: str) -> str | None:
    """네이버 플레이스 링크에서 place ID 추출"""
    m = re.search(r"place[/=](\d+)", link)
    return m.group(1) if m else None


def main():
    supabase = init_supabase()

    result = supabase.table("spots").select("id, name, region, address, lat, lng, naver_place_id").execute()
    spots = result.data or []
    log.info(f"총 {len(spots)}개 가게 처리 시작")

    updated = 0
    failed = []

    for i, spot in enumerate(spots):
        name = spot["name"]
        log.info(f"[{i+1}/{len(spots)}] {name}")

        item = search_local(name)
        time.sleep(DELAY)

        if not item:
            log.warning(f"  검색 결과 없음")
            failed.append(name)
            continue

        clean_title = re.sub(r"<[^>]+>", "", item["title"])
        road_addr = item.get("roadAddress") or item.get("address", "")
        link = item.get("link", "")
        mapx = item.get("mapx", "")
        mapy = item.get("mapy", "")

        log.info(f"  검색결과: {clean_title}")
        log.info(f"  주소: {road_addr} | mapx={mapx}, mapy={mapy}")

        if not mapx or not mapy:
            log.warning(f"  좌표 없음, 스킵")
            failed.append(name)
            continue

        try:
            lat, lng = parse_coords(mapx, mapy)
        except Exception as e:
            log.warning(f"  좌표 변환 실패: {e}")
            failed.append(name)
            continue

        # 제주도 범위 검증 (lat: 33.1~33.6, lng: 126.1~127.0)
        if not (33.1 <= lat <= 33.6 and 126.1 <= lng <= 127.0):
            log.warning(f"  좌표가 제주도 범위 밖: {lat:.4f}, {lng:.4f} → 스킵")
            failed.append(name)
            continue

        place_id = extract_place_id(link)
        log.info(f"  좌표: {lat:.6f}, {lng:.6f} (place_id: {place_id})")

        update_data = {
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "address": road_addr,
        }
        if place_id:
            update_data["naver_place_id"] = place_id

        try:
            supabase.table("spots").update(update_data).eq("id", spot["id"]).execute()
            updated += 1
            log.info(f"  ✓ 업데이트 완료")
        except Exception as e:
            log.error(f"  DB 업데이트 실패: {e}")
            failed.append(name)

    log.info("=" * 50)
    log.info(f"완료: {updated}/{len(spots)}개 업데이트")
    if failed:
        log.warning(f"실패 ({len(failed)}개): {', '.join(failed)}")


if __name__ == "__main__":
    main()

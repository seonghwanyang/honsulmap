"""
실패했던 가게들을 여러 전략으로 재검색해서
실제 존재하는지 확인 + 좌표 업데이트.

전략:
  1) "{name} {region명}" (원본)
  2) "{name} 제주"
  3) "{name}" 단독
  4) instagram_id (예: jung_nip → "중립" 같은 계정명 그대로)
  5) 괄호/특수문자 제거한 변형
"""

import os
import sys
import re
import io
import time
import json
import logging
import requests
from dotenv import load_dotenv
from supabase import create_client

# UTF-8 console (Windows cp949 대응)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", line_buffering=True)

load_dotenv(".env.local")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger(__name__)

SEARCH_CLIENT_ID = "mQgUkdWQOWSfr1rFb6d9"
SEARCH_CLIENT_SECRET = "eWR0ZJVkhd"
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

REGION_MAP = {
    "jeju": "제주시",
    "aewol": "애월",
    "seogwipo": "서귀포",
    "east": "제주",
    "west": "제주",
}

# update_coords.py 실행 후 DB에 업데이트되지 않은 가게들(실패 20개).
# 로그의 cp949 mojibake를 UTF-8로 풀어 이름을 복원한 것.
# 실제로 여기선 DB에서 전체 가져온 뒤, 좌표가 seed 초기값 근처인 놈들만 골라서 재시도함.

def clean(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s)


def parse_coords(mapx: str, mapy: str):
    return float(mapy) / 10_000_000, float(mapx) / 10_000_000


def search(q: str):
    url = "https://openapi.naver.com/v1/search/local.json"
    headers = {
        "X-Naver-Client-Id": SEARCH_CLIENT_ID,
        "X-Naver-Client-Secret": SEARCH_CLIENT_SECRET,
    }
    r = requests.get(url, headers=headers, params={"query": q, "display": 5}, timeout=10)
    if r.status_code != 200:
        return []
    return r.json().get("items", [])


def pick_best(items, name: str, require_jeju=True):
    """제주도 범위 안에 있고 이름이 가장 비슷한 결과 선택"""
    best = None
    for item in items:
        title = clean(item["title"])
        mapx = item.get("mapx")
        mapy = item.get("mapy")
        if not mapx or not mapy:
            continue
        lat, lng = parse_coords(mapx, mapy)
        if require_jeju and not (33.1 <= lat <= 33.6 and 126.1 <= lng <= 127.0):
            continue
        score = 0
        if name == title:
            score = 100
        elif name in title or title in name:
            score = 50
        else:
            # 공백 무시하고 비교
            n, t = name.replace(" ", ""), title.replace(" ", "")
            if n == t:
                score = 90
            elif n in t or t in n:
                score = 40
        if best is None or score > best[0]:
            best = (score, item, lat, lng, title)
    return best


def try_strategies(name: str, region: str, insta: str | None):
    """여러 쿼리 전략을 시도해서 첫 번째 매칭 반환"""
    area = REGION_MAP.get(region, "제주")
    queries = [
        f"{name} {area}",
        f"{name} 제주",
        name,
        # 괄호 안 내용 제거 (예: "에미(EMI)" → "에미")
        re.sub(r"\s*\([^)]*\)", "", name).strip() + f" {area}" if "(" in name else None,
        # 공백 제거
        name.replace(" ", "") + f" {area}",
    ]
    queries = [q for q in queries if q]

    for i, q in enumerate(queries):
        items = search(q)
        time.sleep(0.3)
        if not items:
            continue
        best = pick_best(items, name)
        if best and best[0] >= 40:
            return q, best
    return None, None


def main():
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    rows = sb.table("spots").select("id, name, region, lat, lng, instagram_id").execute().data or []
    log.info(f"전체 {len(rows)}개")

    # 업데이트 안 된 것 = 좌표가 seed 초기값 그대로인 것
    # seed는 33.49~33.51 (제주시 기준) 주변에 0.001 단위로 찍혀있음
    # update_coords 실행 후 소수점 6자리로 업데이트됨. 기존은 4자리.
    # → round(lat, 4) == lat 이면 seed 원본일 가능성 높음
    candidates = []
    for r in rows:
        lat, lng = r["lat"], r["lng"]
        # 4자리 이하 정밀도면 seed 값 의심
        if abs(round(lat, 4) - lat) < 1e-9 and abs(round(lng, 4) - lng) < 1e-9:
            candidates.append(r)

    log.info(f"의심되는(미업데이트) 가게: {len(candidates)}개")
    log.info("=" * 60)

    found = []
    not_found = []
    for i, r in enumerate(candidates):
        name = r["name"]
        log.info(f"[{i+1}/{len(candidates)}] {name} (insta: {r.get('instagram_id')})")
        q, best = try_strategies(name, r.get("region", ""), r.get("instagram_id"))
        if best:
            score, item, lat, lng, title = best
            addr = item.get("roadAddress") or item.get("address", "")
            log.info(f"  ✓ 쿼리='{q}' → {title} ({addr}) score={score}")
            found.append({"id": r["id"], "name": name, "new_lat": lat, "new_lng": lng,
                          "addr": addr, "title": title, "query": q, "score": score})
        else:
            log.info(f"  ✗ 모든 전략 실패")
            not_found.append(name)

    log.info("=" * 60)
    log.info(f"재검색 성공: {len(found)}")
    log.info(f"재검색 실패(존재 의심): {len(not_found)}")
    if not_found:
        log.info("실패 목록:")
        for n in not_found:
            log.info(f"  - {n}")

    # 결과를 JSON으로도 저장 (UTF-8)
    with open("scripts/verify_result.json", "w", encoding="utf-8") as f:
        json.dump({"found": found, "not_found": not_found}, f, ensure_ascii=False, indent=2)
    log.info("결과: scripts/verify_result.json 저장됨")


if __name__ == "__main__":
    main()

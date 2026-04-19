"""
네이버맵 매칭 안 된 가게 정리:
  1) 제주아홉(금능): 수동 좌표 업데이트 (Naver에 "제주아홉 본점 협재점"으로 있음)
  2) 나머지 16개: DB에서 DELETE (CASCADE로 stories/comments/mood_votes 함께 삭제)
"""
import os, sys, io, logging
from dotenv import load_dotenv
from supabase import create_client

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
load_dotenv(".env.local")

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger(__name__)

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

# 수동 업데이트 대상 (Naver Local Search에서 괄호 때문에 매칭 실패한 케이스)
MANUAL_UPDATES = {
    "제주아홉(금능)": {
        "lat": 33.389235,
        "lng": 126.231612,
        "address": "제주특별자치도 제주시 한림읍 금능길 81-1",
    },
}

def main():
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    rows = sb.table("spots").select("id, name, lat, lng").execute().data or []

    # ≤4자리 소수점 = 업데이트 안 된 놈
    stale = [r for r in rows if abs(round(r["lat"], 4) - r["lat"]) < 1e-9]
    log.info(f"전체 {len(rows)}개, 미업데이트 {len(stale)}개")
    for r in stale:
        log.info(f"  - {r['name']}  ({r['lat']}, {r['lng']})")

    log.info("\n1단계: 수동 업데이트")
    for name, new in MANUAL_UPDATES.items():
        row = next((r for r in stale if r["name"] == name), None)
        if not row:
            log.info(f"  {name}: 대상 아님, 스킵")
            continue
        sb.table("spots").update(new).eq("id", row["id"]).execute()
        log.info(f"  ✓ {name} → ({new['lat']}, {new['lng']}) / {new['address']}")

    log.info("\n2단계: 나머지 삭제")
    manual_names = set(MANUAL_UPDATES.keys())
    to_delete = [r for r in stale if r["name"] not in manual_names]
    log.info(f"  삭제 대상: {len(to_delete)}개")
    for r in to_delete:
        try:
            sb.table("spots").delete().eq("id", r["id"]).execute()
            log.info(f"  ✓ 삭제: {r['name']}")
        except Exception as e:
            log.error(f"  ✗ 삭제 실패: {r['name']} — {e}")

    # 최종 상태
    final = sb.table("spots").select("id", count="exact").execute()
    log.info(f"\n최종 spots 개수: {final.count}")

if __name__ == "__main__":
    main()

"""최종 DB 상태 점검
  - 중복 placeId (같은 id가 여러 spot에 할당됨 = 버그)
  - naver_place_id NULL 개수
  - 세화마을회관처럼 주소 vs 이름 불일치 의심 케이스
"""
import os, sys, io
from dotenv import load_dotenv
from supabase import create_client
from collections import Counter

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
load_dotenv(".env.local")

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

def main():
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    rows = sb.table("spots").select("id, name, region, lat, lng, address, naver_place_id").order("name").execute().data or []
    print(f"총 spots: {len(rows)}")

    # 1. naver_place_id 분포
    null_pid = [r for r in rows if not r.get("naver_place_id")]
    print(f"\nnaver_place_id 없음: {len(null_pid)}개")
    for r in null_pid:
        print(f"  - {r['name']} | {r.get('address','')}")

    # 2. 중복 placeId
    pids = [r["naver_place_id"] for r in rows if r.get("naver_place_id")]
    dups = [pid for pid, cnt in Counter(pids).items() if cnt > 1]
    print(f"\n중복 placeId: {len(dups)}개")
    for pid in dups:
        print(f"  pid={pid}:")
        for r in rows:
            if r.get("naver_place_id") == pid:
                print(f"    - {r['name']} | {r.get('address','')} | ({r['lat']:.6f},{r['lng']:.6f})")

    # 3. 세화마을회관처럼 이름/주소 miss match
    print("\n이름↔주소 불일치 의심:")
    for r in rows:
        name = r["name"]
        addr = (r.get("address") or "")
        # 가게명에 들어있는 핵심 토큰이 주소에도 있어야 함 (예: "세화" → 주소에 "세화" 있는지)
        key_tokens = [t for t in name.split() if len(t) >= 2 and "제주" not in t and "혼술바" not in t]
        miss = False
        for t in key_tokens[:1]:  # 첫 토큰만 체크
            tc = t.replace("(", "").replace(")", "")
            if tc and tc not in addr and tc.replace("제주","") not in addr:
                # 주소에 포함된 이웃 지역인지 — 세화마을회관 주소가 표선인 경우 등
                pass
        # 유명한 포인트 체크: 세화마을회관은 "구좌읍 세화" 주소여야
        if name == "세화마을회관" and "표선" in addr:
            print(f"  ⚠️ {name} | {addr}")

if __name__ == "__main__":
    main()

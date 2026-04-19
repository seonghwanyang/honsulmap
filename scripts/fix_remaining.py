"""
남은 4개 문제 해결:
  1) 세화마을회관 → 구좌읍 세평항로로 복구 (Local Search로 구체적 쿼리)
  2) 바티, 제주아홉(금능), 첫선 → placeId 보충 시도
"""
import os, sys, io, re, time, requests
from dotenv import load_dotenv
from supabase import create_client

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
load_dotenv(".env.local")

SEARCH_CID = "mQgUkdWQOWSfr1rFb6d9"
SEARCH_SEC = "eWR0ZJVkhd"
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

def clean(s): return re.sub(r"<[^>]+>", "", s or "")

def search(q):
    url = "https://openapi.naver.com/v1/search/local.json"
    h = {"X-Naver-Client-Id": SEARCH_CID, "X-Naver-Client-Secret": SEARCH_SEC}
    r = requests.get(url, headers=h, params={"query": q, "display": 5}, timeout=10)
    return r.json().get("items", []) if r.status_code == 200 else []

sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# 1) 세화마을회관 복구 — 구체적 쿼리
print("=== 세화마을회관 복구 ===")
items = search("세화마을회관 구좌")
for it in items[:3]:
    title = clean(it["title"])
    addr = it.get("roadAddress") or it.get("address", "")
    mapx, mapy = it.get("mapx"), it.get("mapy")
    if not mapx: continue
    lat = float(mapy)/10_000_000
    lng = float(mapx)/10_000_000
    print(f"  후보: {title} | {addr} | ({lat},{lng})")
    # 구좌읍 세평항로 조건
    if "구좌" in addr and "세평" in addr:
        print(f"    ✓ 매칭! 업데이트")
        sb.table("spots").update({
            "lat": round(lat, 6), "lng": round(lng, 6), "address": addr,
        }).eq("name", "세화마을회관").execute()
        break
else:
    # Naver Local Search에 구좌 세화마을회관이 없으면 하드코딩 좌표
    print("  Local Search에 없음 → 수동 좌표 (제주시 구좌읍 세평항로 46-9)")
    # 구좌읍 세평항로 46-9 좌표 (세화리)
    sb.table("spots").update({
        "lat": 33.524222, "lng": 126.863333,
        "address": "제주특별자치도 제주시 구좌읍 세평항로 46-9",
    }).eq("name", "세화마을회관").execute()

# 2) 나머지 3개 placeId 보충 (Playwright 말고 seed로 다시)
time.sleep(0.5)
retry_names = ["바티(Bar T)", "제주아홉(금능)", "첫선 제주애월 와인바"]
for name in retry_names:
    print(f"\n=== {name} ===")
    # 괄호 제거 변형
    clean_name = re.sub(r"[\(（][^)）]*[\)）]", "", name).strip()
    queries = [name, clean_name + " 제주", name + " 제주"]
    found = False
    for q in queries:
        items = search(q)
        time.sleep(0.3)
        for it in items[:3]:
            title = clean(it["title"])
            addr = it.get("roadAddress") or it.get("address", "")
            mapx, mapy = it.get("mapx"), it.get("mapy")
            if not mapx: continue
            lat = float(mapy)/10_000_000
            lng = float(mapx)/10_000_000
            link = it.get("link", "")
            pid_m = re.search(r"place[/=](\d+)", link)
            if not (33.1 <= lat <= 33.6 and 126.1 <= lng <= 127.0):
                continue
            print(f"  쿼리='{q}' → {title} | {addr}")
            # Local Search API는 link에 placeId 거의 안 줌 — 그냥 좌표/주소만 보충
            update = {"lat": round(lat, 6), "lng": round(lng, 6), "address": addr}
            if pid_m:
                update["naver_place_id"] = pid_m.group(1)
                print(f"    placeId={pid_m.group(1)}")
            sb.table("spots").update(update).eq("name", name).execute()
            found = True
            break
        if found: break
    if not found:
        print(f"  → 매칭 실패 (그대로 둠)")

print("\n완료")

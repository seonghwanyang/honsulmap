"""
업데이트된 66개 가게의 Naver 매칭 정확도 감사.
각 가게를 다시 검색해서:
  - 현재 DB 주소 vs Naver 최신 주소 비교
  - 가게명 vs Naver title 유사도 점수
  - 불일치 의심 케이스 플래깅
"""
import os, sys, io, re, time, json, logging
from dotenv import load_dotenv
import requests
from supabase import create_client

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
load_dotenv(".env.local")

logging.basicConfig(level=logging.INFO, format="%(message)s", handlers=[logging.StreamHandler(sys.stdout)])
log = logging.getLogger(__name__)

SEARCH_CID = "mQgUkdWQOWSfr1rFb6d9"
SEARCH_SEC = "eWR0ZJVkhd"
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

REGION_MAP = {"jeju": "제주시", "aewol": "애월", "seogwipo": "서귀포", "east": "제주", "west": "제주"}

def clean(s): return re.sub(r"<[^>]+>", "", s or "")

def similarity(a: str, b: str) -> int:
    """0~100 간단 이름 유사도"""
    a_, b_ = a.replace(" ", ""), b.replace(" ", "")
    if a_ == b_: return 100
    if a_ in b_ or b_ in a_: return 70
    common = set(a_) & set(b_)
    if not common: return 0
    return int(len(common) / max(len(set(a_)), len(set(b_))) * 50)

def search(q: str):
    url = "https://openapi.naver.com/v1/search/local.json"
    h = {"X-Naver-Client-Id": SEARCH_CID, "X-Naver-Client-Secret": SEARCH_SEC}
    r = requests.get(url, headers=h, params={"query": q, "display": 5}, timeout=10)
    return r.json().get("items", []) if r.status_code == 200 else []

def main():
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    rows = sb.table("spots").select("id, name, region, address, lat, lng").execute().data or []
    # 업데이트된 것만 (6자리 소수점 = Naver API 결과)
    updated = [r for r in rows if abs(round(r["lat"], 4) - r["lat"]) > 1e-9]
    log.info(f"감사 대상: {len(updated)}개")
    log.info("=" * 70)

    suspicious = []
    for i, r in enumerate(updated):
        name = r["name"]
        region = r.get("region", "")
        area = REGION_MAP.get(region, "제주")
        items = search(f"{name} {area}")
        time.sleep(0.3)
        if not items:
            log.info(f"[{i+1}/{len(updated)}] {name} — 재검색 안 나옴(일시적?) 스킵")
            continue
        # 제주 안쪽 + 이름 유사도 높은 놈 고르기
        best = None
        for it in items:
            title = clean(it["title"])
            mapx, mapy = it.get("mapx"), it.get("mapy")
            if not mapx or not mapy:
                continue
            lat = float(mapy)/10_000_000
            lng = float(mapx)/10_000_000
            if not (33.1 <= lat <= 33.6 and 126.1 <= lng <= 127.0):
                continue
            sc = similarity(name, title)
            if best is None or sc > best[0]:
                best = (sc, title, lat, lng, it.get("roadAddress") or it.get("address", ""))

        if not best:
            log.info(f"[{i+1}/{len(updated)}] {name} — 제주 안 매칭 없음 (DB 좌표: {r['lat']:.4f},{r['lng']:.4f})")
            continue
        sc, title, lat, lng, addr = best
        # DB 좌표 vs Naver 재검색 좌표 거리 (대충)
        dist_km = ((lat - r["lat"])**2 + (lng - r["lng"])**2) ** 0.5 * 111
        flag = ""
        if sc < 60:
            flag = " ⚠️ 이름유사도낮음"
        if dist_km > 0.5:
            flag += f" ⚠️ 좌표차{dist_km:.1f}km"
        log.info(f"[{i+1}/{len(updated)}] {name} → {title} | score={sc} dist={dist_km:.2f}km{flag}")
        log.info(f"      DB주소: {r.get('address','')}")
        log.info(f"      Naver: {addr}")
        if flag:
            suspicious.append({"name": name, "naver_title": title, "score": sc,
                              "dist_km": round(dist_km, 2),
                              "db_addr": r.get("address", ""), "naver_addr": addr,
                              "db_coord": [r["lat"], r["lng"]], "naver_coord": [lat, lng]})

    log.info("=" * 70)
    log.info(f"의심 케이스: {len(suspicious)}개")
    with open("scripts/audit_result.json", "w", encoding="utf-8") as f:
        json.dump(suspicious, f, ensure_ascii=False, indent=2)
    log.info("→ scripts/audit_result.json 저장")
    for s in suspicious:
        log.info(f"\n  • {s['name']} → {s['naver_title']} (유사도 {s['score']}, {s['dist_km']}km)")
        log.info(f"    DB: {s['db_addr']}")
        log.info(f"    Naver 재검색: {s['naver_addr']}")

if __name__ == "__main__":
    main()

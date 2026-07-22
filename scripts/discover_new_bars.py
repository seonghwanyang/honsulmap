"""지역 혼술바 신규 발굴 — 네이버 스윕 → DB 대조 → 이미 등록된 곳 제외 → 신규만 출력.

DB에 있는 곳(naver_place_id 또는 instagram_id 일치)은 빼고, 새 가게만 리스트업한다.
'혼술' 신호(가게명에 혼술/혼자)를 flag로 표시(검증 단계에서 og:title로 최종 판정).

Usage: python scripts/discover_new_bars.py "대전 혼술바" "둔산동 혼술바" ...
출력: 신규후보를 TSV로 (name / addr / lat,lng / place_id / ig / honsul?)
"""
import sys, os, time, re
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dotenv import load_dotenv
load_dotenv(".env.local")
import naver_map_resync_seoul as R
from worker.db import get_client
from playwright.sync_api import sync_playwright

args = sys.argv[1:]
# --honsul: IG 추출 전에 가게명 '혼술/혼자'로 선필터(순수 혼술바 대량 스윕 속도↑)
HONSUL_ONLY = "--honsul" in args
queries = [a for a in args if a != "--honsul"]
if not queries:
    sys.exit('쿼리를 넣어라: python scripts/discover_new_bars.py [--honsul] "대전 혼술바" ...')

# 1) DB의 기존 place_id / instagram_id 집합 (dedup 기준)
sb = get_client()
rows = sb.table("spots").select("naver_place_id, instagram_id, name").execute().data
db_pids = {str(r["naver_place_id"]) for r in rows if r.get("naver_place_id")}
db_igs = {(r["instagram_id"] or "").lower().lstrip("@") for r in rows if r.get("instagram_id")}
print(f"[dedup] DB 기존: place_id {len(db_pids)}개 · ig {len(db_igs)}개", file=sys.stderr)

HONSUL = re.compile(r"혼술|혼자")

def ig_from_detail(page, pid):
    try:
        page.goto(f"https://m.place.naver.com/restaurant/{pid}/home", wait_until="domcontentloaded", timeout=30000)
        time.sleep(2.5)
        html = page.content()
        igs = sorted(set(re.findall(r"instagram\.com/([A-Za-z0-9._]{3,30})", html)))
        noise = {"accounts", "explore", "p", "reel", "reels", "stories", "instagram"}
        igs = [x for x in igs if x.lower() not in noise]
        return igs[0] if igs else ""
    except Exception:
        return ""

seen, new_rows = set(), []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale="ko-KR", viewport={"width": 1280, "height": 800},
    )
    page = ctx.new_page()
    try:
        page.goto("https://map.naver.com/", wait_until="domcontentloaded", timeout=30000)
    except Exception:
        pass
    time.sleep(2)

    candidates = {}  # pid -> place (dedup within sweep)
    for q in queries:
        for pl in R.search_one(page, q):
            pid = str(pl.get("id", ""))
            if pid and pid not in candidates and pid not in db_pids:  # DB에 있으면 스킵
                candidates[pid] = pl
        time.sleep(3)
    if HONSUL_ONLY:
        candidates = {pid: pl for pid, pl in candidates.items() if HONSUL.search(pl.get("name", ""))}
    print(f"[sweep] 신규 후보(place 기준) {len(candidates)}곳{' (혼술 선필터)' if HONSUL_ONLY else ''} — IG 추출 중...", file=sys.stderr)

    for pid, pl in candidates.items():
        ig = ig_from_detail(page, pid)
        if ig and ig.lower() in db_igs:  # IG가 이미 DB에 → 같은 가게, 스킵
            continue
        name = pl.get("name", "")
        addr = pl.get("roadAddress") or pl.get("address", "")
        flag = "혼술" if HONSUL.search(name) else ""
        new_rows.append((name, addr, f"{pl.get('y')},{pl.get('x')}", pid, ig or "-", flag))
        time.sleep(2.0)
    b.close()

print("name\taddress\tlatlng\tplace_id\tinstagram\thonsul")
for r in new_rows:
    print("\t".join(r))
print(f"\n[결과] 신규 {len(new_rows)}곳 (DB 중복 제외 완료)", file=sys.stderr)

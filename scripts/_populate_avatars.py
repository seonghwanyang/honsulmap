"""인스타 프사 → Supabase Storage(spot-avatars) 저장 → spots.avatar_url 갱신.
프로필 HTML 페이지의 og:image로 프사 URL을 얻는다(web_profile_info JSON은 ~6회 후 401,
HTML 페이지는 200 유지). 이미지 바이트를 다운받아 보관(IG CDN URL은 만료됨).

Usage: python scripts/_populate_avatars.py [개수|all|benefits]
  benefits = 혜택 활성 가게만 (혜택페이지용 우선). 기본 30.
"""
import sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from dotenv import load_dotenv
load_dotenv(".env.local")
from worker.db import get_client
from playwright.sync_api import sync_playwright

arg = sys.argv[1] if len(sys.argv) > 1 else "30"
BENEFITS_ONLY = arg == "benefits"
LIMIT = 100000 if arg in ("all", "benefits") else int(arg)
sb = get_client()

try:
    sb.storage.create_bucket("spot-avatars", options={"public": "true"})
    print("버킷 spot-avatars 생성")
except Exception as e:
    print(f"버킷 준비됨 ({str(e)[:50]})")

rows = (
    sb.table("spots").select("id, slug, instagram_id, avatar_url, benefit_active")
    .eq("category", "bar").not_.is_("instagram_id", "null").execute().data
)
todo = [r for r in rows if r.get("instagram_id") and not r.get("avatar_url")
        and (not BENEFITS_ONLY or r.get("benefit_active"))][:LIMIT]
print(f"대상 {len(todo)}곳{' (혜택활성만)' if BENEFITS_ONLY else ''}\n")

ok = dead = 0
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale="ko-KR",
    )
    page = ctx.new_page()
    for r in todo:
        h, slug = r["instagram_id"], r["slug"]
        try:
            page.goto(f"https://www.instagram.com/{h}/", wait_until="domcontentloaded", timeout=30000)
            time.sleep(1.5)
            pic = None
            try:
                pic = page.locator("meta[property='og:image']").first.get_attribute("content", timeout=5000)
            except Exception:
                pic = None
            # 실제 프사 CDN만 채택(로그인월 generic 로고 배제)
            if not pic or ("cdninstagram" not in pic and "scontent" not in pic):
                print(f"✗ {slug} @{h} 프사없음/죽음"); dead += 1; time.sleep(2.5); continue
            img = page.request.get(pic).body()
            key = f"{r['id']}.jpg"  # UUID 키(한글 슬러그 방지)
            sb.storage.from_("spot-avatars").upload(key, img, {"content-type": "image/jpeg", "upsert": "true"})
            public = sb.storage.from_("spot-avatars").get_public_url(key)
            sb.table("spots").update({"avatar_url": public}).eq("slug", slug).execute()
            print(f"✓ {slug} ({len(img)//1024}KB)"); ok += 1
        except Exception as e:
            print(f"✗ {slug} @{h} ERROR {str(e)[:70]}"); dead += 1
        time.sleep(2.5)
    b.close()
print(f"\n완료: 저장 {ok} · 실패 {dead}")

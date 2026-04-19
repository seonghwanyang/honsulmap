"""
21개 알려진-invalid username은 건너뛰고
나머지 user_id 없는 가게만 재캐시.
rate limit 재유발 방지.
"""
import os, sys, io, time
from urllib.parse import unquote
import requests as req
from dotenv import load_dotenv
from supabase import create_client

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
load_dotenv('.env.local')

IG_APP_ID = "936619743392459"
SKIP_404 = {
    'fingerprint_jeju','dongbaek_byeoljang','yahae_jeju','firstline_jeju',
    'deadmanscay','jangyeol_jeju','peroz_jeju','doeldaero_','jayuuiji_seogwipo',
    'hunjip_jeju','seosul_jeju','slowboat_jeju','hwasan_jeju','dalsamak_jeju',
    'yeokgeuni_jeju','hyeopjae_1st','fredhersh_jeju','jeoksim_jeju','gujwashanghoe',
    'tuned_jeju','sul_way_jeju'
}

# cooldown 대기
COOLDOWN = 600  # 10분 기다린 후 시도
print(f"⏳ IG rate limit cooldown {COOLDOWN}s 대기...")
time.sleep(COOLDOWN)
print("▶ 시작")

s = req.Session()
s.cookies.update({
    "sessionid": unquote(os.environ["IG_SESSION_ID"]),
    "csrftoken": os.environ["IG_CSRF_TOKEN"],
    "ds_user_id": os.environ["IG_DS_USER_ID"],
    "ig_did": os.environ.get("IG_DID", ""),
    "mid": os.environ.get("IG_MID", ""),
})
s.headers.update({
    "x-ig-app-id": IG_APP_ID,
    "x-asbd-id": "359341",
    "x-csrftoken": os.environ["IG_CSRF_TOKEN"],
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/146.0 Safari/537.36",
    "origin": "https://www.instagram.com",
    "referer": "https://www.instagram.com/",
})

sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
rows = sb.table("spots").select("id, name, instagram_id, instagram_user_id").not_.is_("instagram_id", "null").neq("instagram_id", "").execute().data or []
need = [r for r in rows if not r.get("instagram_user_id") and r["instagram_id"] not in SKIP_404]
print(f"캐시 필요 (404 제외): {len(need)}개")

ok = err = 0
for i, r in enumerate(need):
    ig = r["instagram_id"]
    print(f"[{i+1}/{len(need)}] @{ig} ... ", end="", flush=True)
    try:
        resp = s.get(f"https://i.instagram.com/api/v1/users/web_profile_info/?username={ig}", timeout=15)
        if resp.status_code == 429:
            print("rate limit, 60초 대기")
            time.sleep(60)
            resp = s.get(f"https://i.instagram.com/api/v1/users/web_profile_info/?username={ig}", timeout=15)
        if resp.status_code != 200:
            print(f"실패 ({resp.status_code})")
            err += 1
            if resp.status_code == 401:
                print("  → 아직 세션 block, 5분 더 대기")
                time.sleep(300)
            continue
        uid = resp.json()["data"]["user"]["id"]
        sb.table("spots").update({"instagram_user_id": str(uid)}).eq("id", r["id"]).execute()
        print(f"OK ({uid})")
        ok += 1
    except Exception as e:
        print(f"예외: {e}")
        err += 1
    time.sleep(3)

print(f"\n완료: {ok} 성공, {err} 실패")

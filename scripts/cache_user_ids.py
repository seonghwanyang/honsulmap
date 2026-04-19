"""
로컬에서 실행: 모든 가게의 instagram_user_id를 조회해서 DB에 캐시
순수 requests + 브라우저 쿠키 사용 (instagrapi 불필요)

사용법:
1. .env.local에 Instagram 쿠키 추가 (IG_SESSION_ID, IG_CSRF_TOKEN, IG_DS_USER_ID)
2. python scripts/cache_user_ids.py
"""

import os
import sys
import time
from urllib.parse import unquote

import requests as req
from supabase import create_client

# .env.local에서 환경변수 로드
env_file = os.path.join(os.path.dirname(__file__), '..', '.env.local')
if os.path.exists(env_file):
    with open(env_file, encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                os.environ.setdefault(k, v)

IG_APP_ID = "936619743392459"


def make_session() -> req.Session:
    s = req.Session()

    sessionid = unquote(os.environ.get("IG_SESSION_ID", ""))
    csrftoken = os.environ.get("IG_CSRF_TOKEN", "")
    ds_user_id = os.environ.get("IG_DS_USER_ID", "")

    if not sessionid or not csrftoken or not ds_user_id:
        print("ERROR: .env.local에 IG_SESSION_ID, IG_CSRF_TOKEN, IG_DS_USER_ID 필요")
        sys.exit(1)

    s.cookies.update({
        "sessionid": sessionid,
        "csrftoken": csrftoken,
        "ds_user_id": ds_user_id,
        "ig_did": os.environ.get("IG_DID", ""),
        "mid": os.environ.get("IG_MID", ""),
    })

    s.headers.update({
        "x-ig-app-id": IG_APP_ID,
        "x-asbd-id": "359341",
        "x-csrftoken": csrftoken,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        "origin": "https://www.instagram.com",
        "referer": "https://www.instagram.com/",
    })

    return s


def main():
    url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        print("ERROR: .env.local에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요")
        sys.exit(1)

    sb = create_client(url, key)
    session = make_session()

    # instagram_user_id가 없는 가게 조회
    response = (
        sb.table("spots")
        .select("id, name, instagram_id, instagram_user_id")
        .not_.is_("instagram_id", "null")
        .neq("instagram_id", "")
        .execute()
    )
    spots = response.data or []
    need_update = [s for s in spots if not s.get("instagram_user_id")]
    print(f"전체: {len(spots)}개, user_id 필요: {len(need_update)}개")

    if not need_update:
        print("모든 가게에 user_id 캐시 완료!")
        return

    success = 0
    errors = 0

    for i, spot in enumerate(need_update):
        ig_id = spot["instagram_id"]
        print(f"[{i+1}/{len(need_update)}] @{ig_id} ... ", end="", flush=True)

        try:
            r = session.get(
                f"https://i.instagram.com/api/v1/users/web_profile_info/?username={ig_id}",
            )
            if r.status_code == 429:
                print(f"rate limit! 30초 대기 후 재시도...")
                time.sleep(30)
                r = session.get(
                    f"https://i.instagram.com/api/v1/users/web_profile_info/?username={ig_id}",
                )
                if r.status_code == 429:
                    print("여전히 rate limit. 중단.")
                    break

            if r.status_code != 200:
                print(f"실패 ({r.status_code})")
                errors += 1
                continue

            user_id = r.json()["data"]["user"]["id"]
            sb.table("spots").update(
                {"instagram_user_id": str(user_id)}
            ).eq("id", spot["id"]).execute()
            print(f"OK ({user_id})")
            success += 1
        except Exception as e:
            print(f"실패: {e}")
            errors += 1

        if i < len(need_update) - 1:
            time.sleep(2)

    print(f"\n완료: {success}개 성공, {errors}개 실패")


if __name__ == "__main__":
    main()

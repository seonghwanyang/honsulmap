"""
인스타 스토리 스크래핑 (순수 requests 기반, 브라우저 쿠키 사용)
GitHub Actions에서 30분마다 실행
"""

import os
import sys
import time
import logging
from datetime import datetime, timezone, timedelta
from urllib.parse import unquote

import requests as req
from supabase import create_client, Client as SupabaseClient

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

BATCH_SIZE = int(os.environ.get("SCRAPE_BATCH_SIZE", "15"))
DELAY_BETWEEN = float(os.environ.get("SCRAPE_DELAY", "3"))

IG_APP_ID = "936619743392459"


def get_env(key: str) -> str:
    val = os.environ.get(key)
    if not val:
        raise EnvironmentError(f"환경변수 {key} 미설정")
    return val


def init_supabase() -> SupabaseClient:
    return create_client(get_env("SUPABASE_URL"), get_env("SUPABASE_KEY"))


def make_session() -> req.Session:
    """브라우저 쿠키로 Instagram 세션 생성"""
    s = req.Session()

    sessionid = unquote(get_env("IG_SESSION_ID"))
    csrftoken = get_env("IG_CSRF_TOKEN")
    ds_user_id = get_env("IG_DS_USER_ID")
    ig_did = os.environ.get("IG_DID", "")
    mid = os.environ.get("IG_MID", "")

    s.cookies.update({
        "sessionid": sessionid,
        "csrftoken": csrftoken,
        "ds_user_id": ds_user_id,
        "ig_did": ig_did,
        "mid": mid,
    })

    s.headers.update({
        "x-ig-app-id": IG_APP_ID,
        "x-asbd-id": "359341",
        "x-csrftoken": csrftoken,
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        "origin": "https://www.instagram.com",
        "referer": "https://www.instagram.com/",
    })

    logger.info("Instagram 세션 설정 완료")
    return s


def get_spots(supabase: SupabaseClient) -> list[dict]:
    response = (
        supabase.table("spots")
        .select("id, name, instagram_id, instagram_user_id, last_scraped_at")
        .not_.is_("instagram_id", "null")
        .neq("instagram_id", "")
        .execute()
    )
    spots = response.data or []
    logger.info(f"가게 수: {len(spots)}")
    return spots


def select_batch(spots: list[dict]) -> list[dict]:
    """캐시된 user_id가 있는 가게만, 오래된 순"""
    cached = [s for s in spots if s.get("instagram_user_id")]
    return sorted(
        cached,
        key=lambda s: s.get("last_scraped_at") or "2000-01-01",
    )[:BATCH_SIZE]


def get_user_id(session: req.Session, supabase: SupabaseClient, spot: dict) -> str | None:
    """username → user_id (DB 캐시)"""
    cached = spot.get("instagram_user_id")
    if cached:
        return cached

    ig_id = spot["instagram_id"]
    try:
        r = session.get(
            f"https://i.instagram.com/api/v1/users/web_profile_info/?username={ig_id}",
        )
        if r.status_code == 429:
            logger.warning(f"  [{ig_id}] rate limit! 중단")
            return "RATE_LIMITED"
        if r.status_code != 200:
            logger.warning(f"  [{ig_id}] profile 조회 실패: {r.status_code}")
            return None

        user_id = r.json()["data"]["user"]["id"]
        supabase.table("spots").update(
            {"instagram_user_id": str(user_id)}
        ).eq("id", spot["id"]).execute()
        logger.info(f"  [{ig_id}] user_id 캐시: {user_id}")
        return str(user_id)
    except Exception as e:
        logger.warning(f"  [{ig_id}] user_id 조회 실패: {e}")
        return None


def fetch_stories(session: req.Session, user_id: str, ig_id: str) -> list[dict]:
    """user_id로 스토리 조회"""
    stories = []
    try:
        r = session.get(
            f"https://i.instagram.com/api/v1/feed/reels_media/?reel_ids={user_id}",
        )
        if r.status_code != 200:
            logger.warning(f"  [{ig_id}] stories 조회 실패: {r.status_code}")
            return stories

        data = r.json()
        reels = data.get("reels", {})
        items = reels.get(user_id, {}).get("items", [])

        now = datetime.now(timezone.utc)

        for item in items:
            taken_at = datetime.fromtimestamp(item["taken_at"], tz=timezone.utc)
            expires_at = taken_at + timedelta(hours=24)

            if now > expires_at:
                continue

            if "video_versions" in item:
                media_url = item["video_versions"][0]["url"]
                media_type = "video"
                thumbnail_url = item.get("image_versions2", {}).get("candidates", [{}])[0].get("url")
            else:
                candidates = item.get("image_versions2", {}).get("candidates", [])
                media_url = candidates[0]["url"] if candidates else None
                media_type = "image"
                thumbnail_url = None

            if not media_url:
                continue

            stories.append({
                "instagram_id": ig_id,
                "media_url": media_url,
                "media_type": media_type,
                "thumbnail_url": thumbnail_url,
                "posted_at": taken_at.isoformat(),
                "expires_at": expires_at.isoformat(),
                "scraped_at": now.isoformat(),
            })

        logger.info(f"  [{ig_id}] 스토리 {len(stories)}개")
    except Exception as e:
        logger.warning(f"  [{ig_id}] 실패: {e}")

    return stories


def upsert_stories(supabase: SupabaseClient, spot_id: str, stories: list[dict]) -> int:
    saved = 0
    for story in stories:
        try:
            supabase.table("stories").upsert(
                {"spot_id": spot_id, **story},
                on_conflict="media_url",
            ).execute()
            saved += 1
        except Exception as e:
            logger.warning(f"  저장 실패: {e}")
    return saved


def delete_expired(supabase: SupabaseClient):
    try:
        now = datetime.now(timezone.utc).isoformat()
        r = supabase.table("stories").delete().lt("expires_at", now).execute()
        deleted = len(r.data) if r.data else 0
        if deleted:
            logger.info(f"만료 스토리 {deleted}개 삭제")
    except Exception as e:
        logger.error(f"만료 삭제 실패: {e}")


def main():
    logger.info("=" * 50)
    logger.info(f"인스타 스토리 스크래핑 (배치 {BATCH_SIZE}, 딜레이 {DELAY_BETWEEN}s)")
    logger.info("=" * 50)

    supabase = init_supabase()
    session = make_session()

    delete_expired(supabase)

    all_spots = get_spots(supabase)
    if not all_spots:
        logger.info("가게 없음")
        return

    batch = select_batch(all_spots)
    logger.info(f"이번 배치: {len(batch)}개")

    total_stories = 0
    total_errors = 0

    for i, spot in enumerate(batch):
        ig_id = spot["instagram_id"]
        logger.info(f"[{i+1}/{len(batch)}] {spot.get('name', '?')} (@{ig_id})")

        user_id = get_user_id(session, supabase, spot)
        if user_id == "RATE_LIMITED":
            logger.warning(f"  [{ig_id}] rate limit → 스킵 (캐시된 가게는 계속 처리)")
            total_errors += 1
            continue
        if not user_id:
            total_errors += 1
            supabase.table("spots").update(
                {"last_scraped_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", spot["id"]).execute()
            continue

        stories = fetch_stories(session, user_id, ig_id)
        if stories:
            saved = upsert_stories(supabase, spot["id"], stories)
            total_stories += saved

        supabase.table("spots").update(
            {"last_scraped_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", spot["id"]).execute()

        if i < len(batch) - 1:
            time.sleep(DELAY_BETWEEN)

    logger.info("=" * 50)
    logger.info(f"완료: {len(batch)}개 처리, {total_stories}개 저장, {total_errors}개 에러")
    logger.info("=" * 50)


if __name__ == "__main__":
    main()

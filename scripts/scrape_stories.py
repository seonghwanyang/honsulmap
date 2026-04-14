"""
인스타 스토리 스크래핑 스크립트 (instagrapi 기반)
GitHub Actions에서 30분마다 실행됨

전략: user_id를 DB에 캐시하고, 한 번에 10개씩만 라운드 로빈 처리
"""

import os
import sys
import json
import time
import base64
import logging
from datetime import datetime, timezone, timedelta

from instagrapi import Client
from instagrapi.exceptions import (
    LoginRequired,
    ChallengeRequired,
    TwoFactorRequired,
    UserNotFound,
)
import instagrapi.mixins.auth as _auth_mixin
from supabase import create_client, Client as SupabaseClient

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# instagrapi pinned_channels_info 버그 패치
_original_login_by_sessionid = _auth_mixin.LoginMixin.login_by_sessionid

def _patched_login_by_sessionid(self, sessionid, *args, **kwargs):
    try:
        return _original_login_by_sessionid(self, sessionid, *args, **kwargs)
    except KeyError as e:
        if "pinned_channels_info" in str(e):
            return True
        raise

_auth_mixin.LoginMixin.login_by_sessionid = _patched_login_by_sessionid

# 한 번에 처리할 가게 수 (rate limit 방지)
BATCH_SIZE = int(os.environ.get("SCRAPE_BATCH_SIZE", "10"))
DELAY_BETWEEN = float(os.environ.get("SCRAPE_DELAY", "8"))


def get_env(key: str) -> str:
    val = os.environ.get(key)
    if not val:
        raise EnvironmentError(f"환경변수 {key} 가 설정되지 않았습니다.")
    return val


def init_supabase() -> SupabaseClient:
    return create_client(get_env("SUPABASE_URL"), get_env("SUPABASE_KEY"))


def init_instagram() -> Client:
    """instagrapi 클라이언트 초기화 — 세션 우선"""
    cl = Client()
    cl.delay_range = [3, 6]

    username = get_env("INSTAGRAM_USERNAME")
    session_b64 = os.environ.get("INSTAGRAM_SESSION")

    if session_b64:
        try:
            session_json = base64.b64decode(session_b64).decode("utf-8")
            session_data = json.loads(session_json)
            cl.set_settings(session_data)

            cookies = session_data.get("cookies", {})
            sessionid = cookies.get("sessionid", "")
            if sessionid:
                cl.login_by_sessionid(sessionid)
                logger.info(f"sessionid로 로그인 성공: {username}")
                return cl

            cl.login(username, get_env("INSTAGRAM_PASSWORD"))
            logger.info(f"세션+비밀번호 로그인 성공: {username}")
            return cl
        except Exception as e:
            logger.warning(f"세션 로드 실패: {e}")

    password = get_env("INSTAGRAM_PASSWORD")
    try:
        cl.login(username, password)
        logger.info("비밀번호 로그인 성공")
    except (TwoFactorRequired, ChallengeRequired) as e:
        logger.error(f"로그인 차단: {e}")
        raise
    except Exception as e:
        logger.error(f"로그인 오류: {e}")
        raise

    return cl


def get_spots_with_instagram(supabase: SupabaseClient) -> list[dict]:
    """instagram_id가 있는 가게 목록 조회 (instagram_user_id 포함)"""
    response = (
        supabase.table("spots")
        .select("id, name, instagram_id, instagram_user_id, last_scraped_at")
        .not_.is_("instagram_id", "null")
        .neq("instagram_id", "")
        .execute()
    )
    spots = response.data or []
    logger.info(f"instagram_id 있는 가게 수: {len(spots)}")
    return spots


def select_batch(spots: list[dict], batch_size: int) -> list[dict]:
    """가장 오래전에 스크래핑된 가게 우선 선택 (라운드 로빈)"""
    sorted_spots = sorted(
        spots,
        key=lambda s: s.get("last_scraped_at") or "2000-01-01",
    )
    return sorted_spots[:batch_size]


def resolve_user_id(cl: Client, supabase: SupabaseClient, spot: dict) -> int | None:
    """username → user_id 변환 (DB 캐시 사용)"""
    # DB에 이미 있으면 바로 사용
    cached_id = spot.get("instagram_user_id")
    if cached_id:
        return int(cached_id)

    # 없으면 API 조회 후 DB에 저장
    instagram_id = spot["instagram_id"]
    try:
        user_id = cl.user_id_from_username(instagram_id)
        # DB에 캐시
        supabase.table("spots").update(
            {"instagram_user_id": str(user_id)}
        ).eq("id", spot["id"]).execute()
        logger.info(f"  [{instagram_id}] user_id 캐시: {user_id}")
        return int(user_id)
    except UserNotFound:
        logger.warning(f"  [{instagram_id}] 프로필 없음")
        return None
    except Exception as e:
        logger.warning(f"  [{instagram_id}] user_id 조회 실패: {e}")
        return None


def fetch_stories(cl: Client, user_id: int, instagram_id: str) -> list[dict]:
    """user_id로 스토리 직접 조회"""
    stories_data = []
    try:
        stories = cl.user_stories(user_id)
        for item in stories:
            now = datetime.now(timezone.utc)
            posted_at = item.taken_at
            if posted_at.tzinfo is None:
                posted_at = posted_at.replace(tzinfo=timezone.utc)
            expires_at = posted_at + timedelta(hours=24)

            if now > expires_at:
                continue

            media_url = str(item.video_url or item.thumbnail_url)
            if not media_url:
                continue

            stories_data.append({
                "instagram_id": instagram_id,
                "media_url": media_url,
                "media_type": "video" if item.video_url else "image",
                "thumbnail_url": str(item.thumbnail_url) if item.thumbnail_url else None,
                "posted_at": posted_at.isoformat(),
                "expires_at": expires_at.isoformat(),
                "scraped_at": now.isoformat(),
            })
        logger.info(f"  [{instagram_id}] 스토리 {len(stories_data)}개")
    except Exception as e:
        logger.warning(f"  [{instagram_id}] 스토리 수집 실패: {type(e).__name__}: {e}")
    return stories_data


def upsert_stories(supabase: SupabaseClient, spot_id: str, stories: list[dict]) -> int:
    """스토리를 Supabase에 upsert"""
    if not stories:
        return 0
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


def delete_expired_stories(supabase: SupabaseClient) -> int:
    try:
        now = datetime.now(timezone.utc).isoformat()
        response = supabase.table("stories").delete().lt("expires_at", now).execute()
        deleted = len(response.data) if response.data else 0
        if deleted > 0:
            logger.info(f"만료 스토리 {deleted}개 삭제")
        return deleted
    except Exception as e:
        logger.error(f"만료 스토리 삭제 실패: {e}")
        return 0


def main():
    logger.info("=" * 50)
    logger.info(f"인스타 스토리 스크래핑 (배치: {BATCH_SIZE}개, 딜레이: {DELAY_BETWEEN}초)")
    logger.info(f"실행 시각: {datetime.now(timezone.utc).isoformat()}")
    logger.info("=" * 50)

    supabase = init_supabase()
    cl = init_instagram()

    # 만료 스토리 정리
    delete_expired_stories(supabase)

    # 가게 목록
    all_spots = get_spots_with_instagram(supabase)
    if not all_spots:
        logger.info("인스타 계정 등록된 가게 없음. 종료.")
        return

    # 라운드 로빈: 가장 오래된 것부터 BATCH_SIZE개만 처리
    batch = select_batch(all_spots, BATCH_SIZE)
    logger.info(f"이번 배치: {len(batch)}개 처리")

    total_stories = 0
    total_errors = 0

    for i, spot in enumerate(batch):
        spot_id = spot["id"]
        instagram_id = spot["instagram_id"]
        logger.info(f"[{i+1}/{len(batch)}] {spot.get('name', '?')} (@{instagram_id})")

        # user_id 조회 (캐시 사용)
        user_id = resolve_user_id(cl, supabase, spot)
        if not user_id:
            total_errors += 1
            # last_scraped_at 업데이트 (다음 라운드에서 건너뛰기 방지)
            supabase.table("spots").update(
                {"last_scraped_at": datetime.now(timezone.utc).isoformat()}
            ).eq("id", spot_id).execute()
            continue

        # 스토리 수집
        stories = fetch_stories(cl, user_id, instagram_id)
        if stories:
            saved = upsert_stories(supabase, spot_id, stories)
            total_stories += saved

        # last_scraped_at 업데이트
        supabase.table("spots").update(
            {"last_scraped_at": datetime.now(timezone.utc).isoformat()}
        ).eq("id", spot_id).execute()

        # 다음 가게 전 대기 (마지막 제외)
        if i < len(batch) - 1:
            time.sleep(DELAY_BETWEEN)

    logger.info("=" * 50)
    logger.info(f"완료: {len(batch)}개 처리, {total_stories}개 스토리 저장, {total_errors}개 에러")
    logger.info("=" * 50)


if __name__ == "__main__":
    main()

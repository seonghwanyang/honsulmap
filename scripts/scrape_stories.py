"""
인스타 스토리 스크래핑 스크립트 (instagrapi 기반)
GitHub Actions에서 30분마다 실행됨
"""

import os
import sys
import json
import time
import base64
import tempfile
import logging
from datetime import datetime, timezone, timedelta

from instagrapi import Client
from instagrapi.exceptions import (
    LoginRequired,
    ChallengeRequired,
    TwoFactorRequired,
)
import instagrapi.mixins.auth as _auth_mixin
from supabase import create_client, Client as SupabaseClient

# instagrapi login_by_sessionid 버그 패치 (pinned_channels_info KeyError)
_original_login_by_sessionid = _auth_mixin.LoginMixin.login_by_sessionid

def _patched_login_by_sessionid(self, sessionid, *args, **kwargs):
    try:
        return _original_login_by_sessionid(self, sessionid, *args, **kwargs)
    except KeyError as e:
        if "pinned_channels_info" in str(e):
            return True
        raise

_auth_mixin.LoginMixin.login_by_sessionid = _patched_login_by_sessionid

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


def get_env(key: str) -> str:
    val = os.environ.get(key)
    if not val:
        raise EnvironmentError(f"환경변수 {key} 가 설정되지 않았습니다.")
    return val


def init_supabase() -> SupabaseClient:
    url = get_env("SUPABASE_URL")
    key = get_env("SUPABASE_KEY")
    return create_client(url, key)


def init_instagram() -> Client:
    """instagrapi 클라이언트 초기화 — 세션 JSON 우선, 없으면 로그인"""
    cl = Client()
    cl.delay_range = [2, 5]  # 요청 간 딜레이 (rate limit 방지)

    username = get_env("INSTAGRAM_USERNAME")

    # 1) 세션 JSON(base64)이 있으면 우선 사용
    session_b64 = os.environ.get("INSTAGRAM_SESSION")
    if session_b64:
        try:
            session_json = base64.b64decode(session_b64).decode("utf-8")
            session_data = json.loads(session_json)
            cl.set_settings(session_data)

            # 세션에 저장된 쿠키로 로그인 시도
            cookies = session_data.get("cookies", {})
            sessionid = cookies.get("sessionid", "")
            if sessionid:
                cl.login_by_sessionid(sessionid)
                logger.info(f"sessionid로 인스타그램 로그인 성공: {username}")
                return cl

            # sessionid 없으면 비밀번호 로그인
            cl.login(username, get_env("INSTAGRAM_PASSWORD"))
            logger.info(f"세션 JSON + 비밀번호로 로그인 성공: {username}")
            return cl
        except LoginRequired:
            logger.warning("세션 만료됨, 비밀번호 로그인 시도")
        except Exception as e:
            logger.warning(f"세션 JSON 로드 실패: {e}")

    # 2) 세션 없으면 새로 로그인
    password = get_env("INSTAGRAM_PASSWORD")
    try:
        logger.info(f"인스타그램 비밀번호 로그인 시도: {username}")
        cl.login(username, password)
        logger.info("인스타그램 로그인 성공")
    except TwoFactorRequired:
        logger.error("2단계 인증 필요 — 서비스 계정에서 2FA를 비활성화하세요")
        raise
    except ChallengeRequired:
        logger.error("Checkpoint 인증 필요 — 브라우저에서 인증 후 세션을 다시 생성하세요")
        raise
    except Exception as e:
        logger.error(f"인스타그램 로그인 오류: {e}")
        raise

    return cl


def save_session_info(cl: Client):
    """현재 세션을 base64로 출력 (디버깅용)"""
    try:
        settings = cl.get_settings()
        settings_json = json.dumps(settings)
        b64 = base64.b64encode(settings_json.encode("utf-8")).decode("utf-8")
        logger.info(f"세션 base64 길이: {len(b64)}")
        # GitHub Actions에서 세션 업데이트가 필요할 때 사용
        # print(f"::set-output name=session::{b64}")
    except Exception as e:
        logger.warning(f"세션 저장 실패: {e}")


def get_spots_with_instagram(supabase: SupabaseClient) -> list[dict]:
    """instagram_id가 있는 가게 목록 조회"""
    try:
        response = (
            supabase.table("spots")
            .select("id, name, instagram_id")
            .not_.is_("instagram_id", "null")
            .neq("instagram_id", "")
            .execute()
        )
        spots = response.data or []
        logger.info(f"instagram_id 있는 가게 수: {len(spots)}")
        return spots
    except Exception as e:
        logger.error(f"가게 목록 조회 실패: {e}")
        raise


def fetch_stories_for_profile(
    cl: Client, instagram_id: str
) -> list[dict]:
    """특정 인스타 계정의 스토리 URL 수집"""
    stories_data = []

    try:
        # username → user_id
        user_id = cl.user_id_from_username(instagram_id)
        stories = cl.user_stories(user_id)

        for item in stories:
            now = datetime.now(timezone.utc)
            posted_at = item.taken_at.replace(tzinfo=timezone.utc) if item.taken_at.tzinfo is None else item.taken_at
            expires_at = posted_at + timedelta(hours=24)

            # 이미 만료된 스토리는 스킵
            if now > expires_at:
                continue

            media_url = str(item.video_url or item.thumbnail_url)
            media_type = "video" if item.video_url else "image"
            thumbnail_url = str(item.thumbnail_url) if item.thumbnail_url else None

            if not media_url:
                continue

            stories_data.append(
                {
                    "instagram_id": instagram_id,
                    "media_url": media_url,
                    "media_type": media_type,
                    "thumbnail_url": thumbnail_url,
                    "posted_at": posted_at.isoformat(),
                    "expires_at": expires_at.isoformat(),
                    "scraped_at": now.isoformat(),
                }
            )

        logger.info(f"  [{instagram_id}] 스토리 {len(stories_data)}개 수집")

    except Exception as e:
        logger.warning(f"  [{instagram_id}] 스토리 수집 실패: {type(e).__name__}: {e}")

    return stories_data


def upsert_stories(
    supabase: SupabaseClient, spot_id: str, stories: list[dict]
) -> int:
    """스토리를 Supabase에 upsert (중복 방지)"""
    if not stories:
        return 0

    saved_count = 0
    for story in stories:
        record = {
            "spot_id": spot_id,
            **story,
        }
        try:
            supabase.table("stories").upsert(
                record,
                on_conflict="media_url",
            ).execute()
            saved_count += 1
        except Exception as e:
            logger.warning(f"  스토리 저장 실패 ({story.get('media_url', '')[:50]}): {e}")

    return saved_count


def delete_expired_stories(supabase: SupabaseClient) -> int:
    """24시간 지난 만료 스토리 삭제"""
    try:
        now = datetime.now(timezone.utc).isoformat()
        response = (
            supabase.table("stories")
            .delete()
            .lt("expires_at", now)
            .execute()
        )
        deleted = len(response.data) if response.data else 0
        if deleted > 0:
            logger.info(f"만료 스토리 {deleted}개 삭제")
        return deleted
    except Exception as e:
        logger.error(f"만료 스토리 삭제 실패: {e}")
        return 0


def scrape_all(
    cl: Client,
    supabase: SupabaseClient,
    spots: list[dict],
    batch_size: int = 10,
    batch_delay: float = 5.0,
) -> dict:
    """모든 가게 스토리 스크래핑 (배치 처리)"""
    total_spots = len(spots)
    total_stories = 0
    total_errors = 0

    for batch_start in range(0, total_spots, batch_size):
        batch = spots[batch_start : batch_start + batch_size]
        batch_num = batch_start // batch_size + 1
        total_batches = (total_spots + batch_size - 1) // batch_size
        logger.info(f"배치 {batch_num}/{total_batches} 처리 중 ({len(batch)}곳)")

        for spot in batch:
            spot_id = spot["id"]
            instagram_id = spot["instagram_id"]
            spot_name = spot.get("name", "?")

            logger.info(f"  처리: {spot_name} (@{instagram_id})")

            try:
                stories = fetch_stories_for_profile(cl, instagram_id)
                if stories:
                    saved = upsert_stories(supabase, spot_id, stories)
                    total_stories += saved
                    logger.info(f"  [{instagram_id}] {saved}개 저장 완료")
            except Exception as e:
                logger.warning(f"  [{instagram_id}] 처리 중 예외 발생, 스킵: {e}")
                total_errors += 1
                continue

        # 마지막 배치가 아니면 대기
        if batch_start + batch_size < total_spots:
            logger.info(f"배치 완료. {batch_delay}초 대기...")
            time.sleep(batch_delay)

    return {
        "total_spots": total_spots,
        "total_stories_saved": total_stories,
        "total_errors": total_errors,
    }


def main():
    logger.info("=" * 50)
    logger.info("인스타 스토리 스크래핑 시작 (instagrapi)")
    logger.info(f"실행 시각: {datetime.now(timezone.utc).isoformat()}")
    logger.info("=" * 50)

    # 초기화
    supabase = init_supabase()
    cl = init_instagram()

    # 만료 스토리 먼저 정리
    logger.info("--- 만료 스토리 정리 ---")
    delete_expired_stories(supabase)

    # instagram_id 있는 가게 목록 조회
    logger.info("--- 가게 목록 조회 ---")
    spots = get_spots_with_instagram(supabase)

    if not spots:
        logger.info("인스타그램 계정이 등록된 가게가 없습니다. 종료.")
        return

    # 스크래핑 실행
    logger.info("--- 스크래핑 시작 ---")
    result = scrape_all(cl, supabase, spots, batch_size=10, batch_delay=5.0)

    # 세션 정보 저장 (디버깅용)
    save_session_info(cl)

    # 결과 요약
    logger.info("=" * 50)
    logger.info("스크래핑 완료")
    logger.info(f"  처리 가게 수: {result['total_spots']}")
    logger.info(f"  저장된 스토리: {result['total_stories_saved']}")
    logger.info(f"  에러 발생 가게: {result['total_errors']}")
    logger.info("=" * 50)


if __name__ == "__main__":
    main()

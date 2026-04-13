"""
인스타 스토리 스크래핑 스크립트
GitHub Actions에서 30분마다 실행됨
"""

import os
import sys
import time
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import instaloader
from supabase import create_client, Client

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


def init_supabase() -> Client:
    url = get_env("SUPABASE_URL")
    key = get_env("SUPABASE_KEY")
    return create_client(url, key)


def init_instaloader() -> instaloader.Instaloader:
    """instaloader 인스턴스 초기화 및 로그인"""
    L = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
        quiet=True,
    )

    username = get_env("INSTAGRAM_USERNAME")
    password = get_env("INSTAGRAM_PASSWORD")

    try:
        logger.info(f"인스타그램 로그인 시도: {username}")
        L.login(username, password)
        logger.info("인스타그램 로그인 성공")
    except instaloader.exceptions.BadCredentialsException:
        logger.error("인스타그램 로그인 실패: 잘못된 계정 정보")
        raise
    except instaloader.exceptions.TwoFactorAuthRequiredException:
        logger.error("2단계 인증이 필요합니다. 서비스 전용 계정에서 비활성화하세요.")
        raise
    except Exception as e:
        logger.error(f"인스타그램 로그인 오류: {e}")
        raise

    return L


def get_spots_with_instagram(supabase: Client) -> list[dict]:
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
    L: instaloader.Instaloader, instagram_id: str
) -> list[dict]:
    """특정 인스타 계정의 스토리 URL 수집"""
    stories_data = []

    try:
        profile = instaloader.Profile.from_username(L.context, instagram_id)
        stories = L.get_stories(userids=[profile.userid])

        for story in stories:
            for item in story.get_items():
                now = datetime.now(timezone.utc)
                posted_at = item.date_utc.replace(tzinfo=timezone.utc)
                expires_at = posted_at + timedelta(hours=24)

                # 이미 만료된 스토리는 스킵
                if now > expires_at:
                    continue

                media_url = item.url
                media_type = "video" if item.is_video else "image"
                thumbnail_url = None

                if item.is_video and hasattr(item, "url"):
                    # 비디오의 경우 썸네일 URL 별도 처리
                    try:
                        thumbnail_url = item.url  # instaloader에서 제공하는 썸네일
                    except Exception:
                        thumbnail_url = None

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

    except instaloader.exceptions.ProfileNotExistsException:
        logger.warning(f"  [{instagram_id}] 프로필 없음 (비공개 또는 삭제됨)")
    except instaloader.exceptions.LoginRequiredException:
        logger.warning(f"  [{instagram_id}] 로그인 필요 (비공개 계정)")
    except instaloader.exceptions.QueryReturnedBadRequestException:
        logger.warning(f"  [{instagram_id}] 잘못된 요청 (rate limit 가능성)")
    except Exception as e:
        logger.warning(f"  [{instagram_id}] 스토리 수집 실패: {type(e).__name__}: {e}")

    return stories_data


def upsert_stories(
    supabase: Client, spot_id: str, stories: list[dict]
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
            # media_url 기준으로 upsert (중복 방지)
            supabase.table("stories").upsert(
                record,
                on_conflict="media_url",
            ).execute()
            saved_count += 1
        except Exception as e:
            logger.warning(f"  스토리 저장 실패 ({story.get('media_url', '')[:50]}): {e}")

    return saved_count


def delete_expired_stories(supabase: Client) -> int:
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
    L: instaloader.Instaloader,
    supabase: Client,
    spots: list[dict],
    batch_size: int = 10,
    batch_delay: float = 3.0,
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
                stories = fetch_stories_for_profile(L, instagram_id)
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
    logger.info("인스타 스토리 스크래핑 시작")
    logger.info(f"실행 시각: {datetime.now(timezone.utc).isoformat()}")
    logger.info("=" * 50)

    # 초기화
    supabase = init_supabase()
    L = init_instaloader()

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
    result = scrape_all(L, supabase, spots, batch_size=10, batch_delay=3.0)

    # 결과 요약
    logger.info("=" * 50)
    logger.info("스크래핑 완료")
    logger.info(f"  처리 가게 수: {result['total_spots']}")
    logger.info(f"  저장된 스토리: {result['total_stories_saved']}")
    logger.info(f"  에러 발생 가게: {result['total_errors']}")
    logger.info("=" * 50)


if __name__ == "__main__":
    main()

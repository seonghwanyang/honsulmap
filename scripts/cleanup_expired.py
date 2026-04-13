"""
만료된 인스타 스토리 정리 스크립트
scrape_stories.py 내부에서도 호출되지만 단독 실행도 가능
"""

import os
import sys
import logging
from datetime import datetime, timezone

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


def delete_expired_stories(supabase: Client) -> int:
    """24시간 지난 만료 스토리 삭제"""
    now = datetime.now(timezone.utc)
    now_iso = now.isoformat()

    logger.info(f"만료 스토리 정리 시작 (기준 시각: {now_iso})")

    try:
        response = (
            supabase.table("stories")
            .delete()
            .lt("expires_at", now_iso)
            .execute()
        )
        deleted = len(response.data) if response.data else 0
        logger.info(f"만료 스토리 {deleted}개 삭제 완료")
        return deleted
    except Exception as e:
        logger.error(f"만료 스토리 삭제 실패: {e}")
        raise


def get_stories_stats(supabase: Client) -> dict:
    """현재 유효한 스토리 통계"""
    try:
        now_iso = datetime.now(timezone.utc).isoformat()

        # 유효한 스토리 수
        active_response = (
            supabase.table("stories")
            .select("id", count="exact")
            .gt("expires_at", now_iso)
            .execute()
        )
        active_count = active_response.count or 0

        return {"active_stories": active_count}
    except Exception as e:
        logger.warning(f"통계 조회 실패: {e}")
        return {"active_stories": -1}


def main():
    logger.info("=" * 50)
    logger.info("만료 스토리 정리 시작")
    logger.info(f"실행 시각: {datetime.now(timezone.utc).isoformat()}")
    logger.info("=" * 50)

    supabase = init_supabase()

    deleted = delete_expired_stories(supabase)
    stats = get_stories_stats(supabase)

    logger.info("=" * 50)
    logger.info("정리 완료")
    logger.info(f"  삭제된 만료 스토리: {deleted}개")
    logger.info(f"  남은 유효 스토리: {stats['active_stories']}개")
    logger.info("=" * 50)


if __name__ == "__main__":
    main()

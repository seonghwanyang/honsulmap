"""최근 수집된 스토리 카운트 (DB read-only). 스크래퍼 검증/감시용.

사용: worker_venv\\Scripts\\python.exe scripts\\check_recent_stories.py [분, 기본20]
"""
import os
import sys
from datetime import datetime, timedelta, timezone

_REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _REPO)

from dotenv import load_dotenv  # noqa: E402

load_dotenv()
load_dotenv(os.path.join(_REPO, "worker", ".env"))
load_dotenv(os.path.join(_REPO, ".env.local"))

from worker.db import get_client  # noqa: E402


def main() -> int:
    mins = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    client = get_client()
    since = (datetime.now(timezone.utc) - timedelta(minutes=mins)).isoformat()

    cnt = (
        client.table("stories")
        .select("id", count="exact")
        .gte("scraped_at", since)
        .execute()
    )
    print(f"[check] 최근 {mins}분 내 수집 스토리: {cnt.count}")

    sample = (
        client.table("stories")
        .select("instagram_id,media_type,media_url,posted_at,scraped_at")
        .gte("scraped_at", since)
        .order("scraped_at", desc=True)
        .limit(8)
        .execute()
    )
    seen = set()
    for r in sample.data or []:
        seen.add(r.get("instagram_id"))
        u = (r.get("media_url") or "")[:55]
        print(f"  @{r.get('instagram_id')} {r.get('media_type'):5} posted={str(r.get('posted_at'))[:19]} {u}")
    print(f"[check] 위 샘플 기준 spot 수: {len(seen)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

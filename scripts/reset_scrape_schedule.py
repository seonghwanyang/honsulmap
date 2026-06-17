"""스케줄 1회 리셋 (DB write: spots.next_scrape_at=now, consecutive_empty=0).

망가진 기간 동안 백오프가 next_scrape_at을 미래(최대 24h)로 밀어둔 걸 되돌려
전체 spot을 즉시 due 로 만든다. **스케줄 컬럼만** 변경 — stories 데이터는 안 건드림.

사용: worker_venv\\Scripts\\python.exe scripts\\reset_scrape_schedule.py
"""
import os
import sys
from datetime import datetime, timezone

_REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _REPO)

from dotenv import load_dotenv  # noqa: E402

load_dotenv()
load_dotenv(os.path.join(_REPO, "worker", ".env"))
load_dotenv(os.path.join(_REPO, ".env.local"))

from worker.db import get_client  # noqa: E402


def main() -> int:
    client = get_client()
    now = datetime.now(timezone.utc).isoformat()

    total = (
        client.table("spots")
        .select("id", count="exact")
        .not_.is_("instagram_id", None)
        .neq("instagram_id", "")
        .execute()
    )
    print(f"[reset] IG handle 있는 spot: {total.count}")

    resp = (
        client.table("spots")
        .update({"next_scrape_at": now, "consecutive_empty": 0})
        .not_.is_("instagram_id", None)
        .neq("instagram_id", "")
        .execute()
    )
    print(f"[reset] next_scrape_at 리셋: {len(resp.data or [])} rows -> 전부 즉시 due")
    return 0


if __name__ == "__main__":
    sys.exit(main())

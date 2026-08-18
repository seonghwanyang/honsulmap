"""storiesig가 '이 IP'에서 응답하는지 검증하는 무DB 프로브.

집 PC(주거 IP)와 GitHub Actions(데이터센터 IP)에서 같은 핸들로 돌려 결과를
비교한다 — Actions에서도 stories>0이면 storiesig는 IP를 안 가린다는 뜻
(예전 Render 차단은 storysaver+Turnstile 시절 얘기라 storiesig는 미검증였음).
DB 접근 없음(시크릿 불필요), 아무것도 쓰지 않음.

Usage: python scripts/_probe_storiesig.py handle1 [handle2 ...]
"""
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from worker.storiesig_client import build_rows, fetch_stories_items_session, make_session


def main() -> int:
    handles = sys.argv[1:]
    if not handles:
        print("usage: python scripts/_probe_storiesig.py <handle> [handle...]")
        return 2
    with_stories = errors = 0
    t_all = time.time()
    with make_session() as session:
        for h in handles:
            t0 = time.time()
            try:
                items = fetch_stories_items_session(session, h)
                rows = build_rows(
                    items, spot_id="probe", instagram_handle=h,
                    fetch_time=datetime.now(timezone.utc),
                )
                sample = (rows[0]["media_url"] if rows else "")[:60]
                print(
                    f"[probe] {h}: stories={len(rows)} elapsed={time.time() - t0:.0f}s {sample}",
                    flush=True,
                )
                if rows:
                    with_stories += 1
            except Exception as exc:
                errors += 1
                print(
                    f"[probe] {h}: ERROR {type(exc).__name__}: {exc} "
                    f"elapsed={time.time() - t0:.0f}s",
                    flush=True,
                )
    print(
        f"[probe] done handles={len(handles)} with_stories={with_stories} "
        f"errors={errors} total={time.time() - t_all:.0f}s"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""storiesig가 '이 IP'에서 응답하는지 검증하는 무DB 프로브 (+화면 채증).

집 PC(주거 IP)와 GitHub Actions(데이터센터 IP)에서 같은 핸들로 돌려 결과를
비교한다. PROBE_SHOTS 환경변수에 디렉토리를 주면 핸들마다 '폴링이 끝난 최종
화면' 스크린샷과 가로챈 API 응답 요약을 남긴다 — stories=0일 때 그 이유가
동의 팝업인지 / 캡차인지 / 차단 페이지인지 / 그냥 빈 결과인지 눈으로 가리는 용도.
DB 접근 없음(시크릿 불필요), 아무것도 쓰지 않음.

Usage: [PROBE_SHOTS=probe_shots] python scripts/_probe_storiesig.py handle1 [handle2 ...]
"""
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from worker.storiesig_client import (
    SITE,
    _build_action,
    _parse_items,
    build_rows,
    make_session,
)

SHOT_DIR = os.environ.get("PROBE_SHOTS", "").strip()


def _action_with_shot(handle: str, captured: list[str]):
    """기존 수집 액션을 그대로 수행한 뒤, 최종 화면을 스크린샷으로 남긴다."""
    inner = _build_action(handle, captured)

    def action(page):
        result = inner(page)
        if SHOT_DIR:
            try:
                Path(SHOT_DIR).mkdir(parents=True, exist_ok=True)
                page.screenshot(path=str(Path(SHOT_DIR) / f"{handle}.png"), full_page=True)
            except Exception as exc:
                print(f"[probe] {handle}: screenshot failed {type(exc).__name__}: {exc}", flush=True)
            try:
                print(f"[probe] {handle}: final url={page.url} title={page.title()!r}", flush=True)
            except Exception:
                pass
        return result

    return action


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
                captured: list[str] = []
                session.fetch(SITE, page_action=_action_with_shot(h, captured))
                items = _parse_items(captured)
                rows = build_rows(
                    items, spot_id="probe", instagram_handle=h,
                    fetch_time=datetime.now(timezone.utc),
                )
                sample = (rows[0]["media_url"] if rows else "")[:60]
                print(
                    f"[probe] {h}: stories={len(rows)} captured={len(captured)} "
                    f"elapsed={time.time() - t0:.0f}s {sample}",
                    flush=True,
                )
                # 가로챈 응답의 정체를 로그로 — 빈 결과인지, 에러 JSON인지, 차단 HTML인지.
                for i, body in enumerate(captured[:3]):
                    print(f"[probe] {h}: captured[{i}] head={body[:120]!r}", flush=True)
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

"""storiesig 행 검증 (읽기 전용, DB 미기록).

검증 항목:
  1) 모든 행이 기존 stories 스키마와 동일한 9개 키를 갖는가
  2) media_url이 cdninstagram/fbcdn 인가
  3) 영상=video_versions+썸네일, 사진=image_versions2+썸네일None 이 맞는가
  4) 영상·사진 케이스를 둘 다 실제로 잡을 때까지 여러 계정 시도

사용: worker_venv\\Scripts\\python.exe scripts\\verify_storiesig_rows.py
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from worker.storiesig_client import build_rows, fetch_stories_items  # noqa: E402

REQUIRED_KEYS = {
    "spot_id", "instagram_id", "instagram_media_id", "media_url",
    "media_type", "thumbnail_url", "posted_at", "expires_at", "scraped_at",
}
HANDLES = ["instagram", "natgeo", "nasa", "9gag", "nike", "zara", "starbucks", "adidas"]


def main() -> int:
    found = {"video": 0, "image": 0}
    problems = 0
    for h in HANDLES:
        try:
            items = fetch_stories_items(h)
        except Exception as e:
            print(f"@{h}: fetch error {type(e).__name__}: {e}")
            continue
        rows = build_rows(items, spot_id="VERIFY", instagram_handle=h,
                          fetch_time=datetime.now(timezone.utc))
        print(f"\n@{h}: {len(items)} items -> {len(rows)} rows")
        for r in rows:
            missing = REQUIRED_KEYS - set(r.keys())
            extra = set(r.keys()) - REQUIRED_KEYS
            is_cdn = ("cdninstagram.com" in r["media_url"]) or ("fbcdn.net" in r["media_url"])
            has_thumb = bool(r["thumbnail_url"])
            ok = (not missing) and (not extra) and is_cdn
            if r["media_type"] == "video" and not has_thumb:
                ok = False
            if r["media_type"] == "image" and has_thumb:
                ok = False  # 사진은 썸네일 None 이어야 함
            if not ok:
                problems += 1
            found[r["media_type"]] = found.get(r["media_type"], 0) + 1
            print(
                f"   [{'OK ' if ok else 'BAD'}] type={r['media_type']:5} "
                f"thumb={'Y' if has_thumb else 'N'} cdn={is_cdn} "
                f"id={r['instagram_media_id']} posted={r['posted_at'][:19]} "
                f"missing={missing or '-'} extra={extra or '-'}"
            )
        if found["video"] and found["image"]:
            print("\n[verify] video+image 둘 다 확보 - early exit")
            break

    print(f"\n[verify] videos={found.get('video',0)} images={found.get('image',0)} problems={problems}")
    if not found.get("image"):
        print("[verify] [!] 사진 스토리를 못 만남(현재 활성 사진 스토리 없음) - 로직은 동일, 추후 사진 핸들로 재확인 권장")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

-- 지도 마커 광고 (네이버 부동산 벤치마크) — 기한제 프리미엄 핀.
-- ad_marker_until이 미래면 광고 활성: 클러스터 면제 + 이름 상시 노출 + 보라 링 + AD 배지.
-- Run in the Supabase SQL Editor.

ALTER TABLE spots ADD COLUMN IF NOT EXISTS ad_marker_until timestamptz;

NOTIFY pgrst, 'reload schema';

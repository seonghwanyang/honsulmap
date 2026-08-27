-- 체크인 선택지 커스텀 — 오늘의 목적·선호 분위기를 가게별로 편집.
-- null = 혼술맵 기본 목록 사용. 사장님이 테이블 설정에서 편집하면 저장된다.
-- Run in the Supabase SQL Editor.

ALTER TABLE store_table_config
  ADD COLUMN IF NOT EXISTS checkin_purposes jsonb,
  ADD COLUMN IF NOT EXISTS checkin_vibes    jsonb;

NOTIFY pgrst, 'reload schema';

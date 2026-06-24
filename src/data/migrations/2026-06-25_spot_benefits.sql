-- 가게 혜택(#8): 인증 사장님이 등록하는 가게별 혜택 1개(상시).
-- benefit_active=true 이고 benefit_title 있으면 지도 마커 🎁 + 가게 상세 배지로 노출.
-- 등록/수정은 사장님 포털 API에서 소유권(spot_members) 확인 후 service role로 기록.
-- 읽기는 spots가 public read라 그대로 노출. (별도 RLS 불필요)
-- Run in the Supabase SQL Editor.

ALTER TABLE spots ADD COLUMN IF NOT EXISTS benefit_title TEXT;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS benefit_detail TEXT;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS benefit_active BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE spots ADD COLUMN IF NOT EXISTS benefit_updated_at TIMESTAMPTZ;

NOTIFY pgrst, 'reload schema';

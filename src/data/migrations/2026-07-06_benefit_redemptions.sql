-- 혜택 리딤(사용 기록) — 어트리뷰션의 심장 (docs/partner-playbook.md §1.1).
-- 손님이 [사용하기] → GPS 300m(서버 검증) or 사장 PIN → 기록.
-- 이 기록이 "혼술맵이 보낸 손님 N명"의 증거가 된다. 성공 시 자동 체크인까지.
-- Run in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS benefit_redemptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id       uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  benefit_title text NOT NULL,                       -- 사용 시점 혜택명 스냅샷
  method        text NOT NULL CHECK (method IN ('gps', 'pin')),
  distance_m    integer,                             -- gps 검증 시 가게와의 거리
  redeemed_at   timestamptz NOT NULL DEFAULT now(),
  -- 같은 혜택은 1인 1회 (혜택명이 바뀌면 새 혜택으로 취급 — 중복 방지의 실체)
  CONSTRAINT benefit_redemptions_once UNIQUE (spot_id, user_id, benefit_title)
);

CREATE INDEX IF NOT EXISTS benefit_redemptions_spot_idx
  ON benefit_redemptions (spot_id, redeemed_at DESC);

ALTER TABLE benefit_redemptions ENABLE ROW LEVEL SECURITY;

-- 쓰기는 service-role API만. 본인 기록 읽기만 허용(사용완료 상태 표시용).
DROP POLICY IF EXISTS benefit_redemptions_select_self ON benefit_redemptions;
CREATE POLICY benefit_redemptions_select_self ON benefit_redemptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 사장 PIN (선택): 설정하면 ①GPS 실패 시 직원 PIN으로 리딤 가능 ②가게측 최종 승인권.
ALTER TABLE spots ADD COLUMN IF NOT EXISTS redeem_pin TEXT;

NOTIFY pgrst, 'reload schema';

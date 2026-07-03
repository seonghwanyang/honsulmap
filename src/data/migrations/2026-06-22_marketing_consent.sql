-- 마케팅 수신 동의 (정보통신망법 광고성 정보 수신 동의). 전역 동의 —
-- "혼술맵의 광고성 정보(혜택·이벤트)를 알림으로 받겠다". 가게별(찜)과 별개로,
-- 푸시 타겟 = 전역 동의 ∧ 그 가게 찜. 한 유저당 현재 상태 1행(최신값) +
-- 마지막 변경 시각. 동의는 인터스티셜 / /me 토글 / (추후) 카카오 싱크에서
-- 기록하고, source로 출처를 구분한다.
-- Run in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS marketing_consent (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  opted_in   BOOLEAN NOT NULL DEFAULT false,
  source     TEXT,  -- 'kakao_sync' | 'interstitial' | 'me_toggle' | 'favorite' | 'checkin'
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE marketing_consent ENABLE ROW LEVEL SECURITY;

-- 유저는 본인 동의 상태만 읽고/생성/변경. (집계·발송은 service role)
DROP POLICY IF EXISTS marketing_consent_select_self ON marketing_consent;
CREATE POLICY marketing_consent_select_self ON marketing_consent
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS marketing_consent_insert_self ON marketing_consent;
CREATE POLICY marketing_consent_insert_self ON marketing_consent
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS marketing_consent_update_self ON marketing_consent;
CREATE POLICY marketing_consent_update_self ON marketing_consent
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';

-- 사장님 공지 (docs/partner-playbook.md §1.6) — admin이 작성,
-- 사장 대시보드 상단 배너(최신 active 1개) + /partner/notices 아카이브.
-- type: banner(기본) | popup(중요 공지 — 1회 팝업 후 배너 강등, 노출 상태는 클라 localStorage).
-- Run in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS partner_notices (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  body       text NOT NULL,
  type       text NOT NULL DEFAULT 'banner' CHECK (type IN ('banner', 'popup')),
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE partner_notices ENABLE ROW LEVEL SECURITY;

-- 읽기: 로그인 유저(사장 대시보드는 로그인 필수). 쓰기: service-role(admin API)만.
DROP POLICY IF EXISTS partner_notices_select_auth ON partner_notices;
CREATE POLICY partner_notices_select_auth ON partner_notices
  FOR SELECT TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';

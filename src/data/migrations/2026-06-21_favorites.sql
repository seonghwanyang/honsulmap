-- 찜(favorite): 로그인 유저가 가게를 찜 → 새 소식(지금은 스토리, 추후 혜택)을
-- 받아보는 구독. 로그인 전용(user_id NOT NULL). spot_id 인덱스는
-- "내 가게를 찜한 유저 수"(사장님 통계 / 푸시 타겟팅)를 받쳐줌.
-- Run in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS favorites (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spot_id    UUID NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, spot_id)
);
CREATE INDEX IF NOT EXISTS favorites_spot_idx ON favorites (spot_id);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- 유저는 본인 찜만 읽고/추가/삭제. 사장님쪽 집계(가게당 찜 수)는 service role.
DROP POLICY IF EXISTS favorites_select_self ON favorites;
CREATE POLICY favorites_select_self ON favorites
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS favorites_insert_self ON favorites;
CREATE POLICY favorites_insert_self ON favorites
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS favorites_delete_self ON favorites;
CREATE POLICY favorites_delete_self ON favorites
  FOR DELETE TO authenticated USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';

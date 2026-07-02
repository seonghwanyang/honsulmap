-- 사용자 프로필(#6 채팅 정체성) — 기본은 user_id 기반 익명 동물닉/이모지(코드에서
-- 결정적 계산, 저장 안 함). 여기 행이 있으면 그 값이 기본값을 덮어쓴다.
--   nickname   : 직접 정한 닉(비우면 기본 동물닉 사용)
--   avatar_url : 직접 올린 프사 사진(비우면 기본 동물 이모지 사용)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id    uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  nickname   text,
  avatar_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 본인 행만 읽기/생성/수정. (채팅 메시지 API는 서비스롤로 전체를 읽으므로 RLS 무관.)
DROP POLICY IF EXISTS "user_profiles_select_own" ON public.user_profiles;
CREATE POLICY "user_profiles_select_own"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
CREATE POLICY "user_profiles_insert_own"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;
CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 프사 사진 버킷. 로그인 유저가 '본인 user_id 폴더'에만 올릴 수 있고, 읽기는 공개
-- (honsulmap.com에서 <img src>로 바로 표시 — 서명 토큰 불필요).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,                          -- 2 MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 업로드는 로그인 유저, 본인 폴더(경로 첫 칸 = user_id)만.
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 공개 읽기.
DROP POLICY IF EXISTS "avatars_select_public" ON storage.objects;
CREATE POLICY "avatars_select_public"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'avatars');

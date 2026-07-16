-- 마커에 표시할 인스타 프로필 사진 URL 컬럼. 값은 Supabase Storage(spot-avatars
-- 버킷)에 저장한 안정 URL — IG CDN URL은 만료되므로 이미지 바이트를 우리가 보관한다.
-- populate: scripts/_populate_avatars.py (버킷은 스크립트가 자동 생성). Run in SQL Editor.

alter table spots add column if not exists avatar_url text;

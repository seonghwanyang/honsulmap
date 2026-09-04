-- 메뉴 사진 — 손님 QR 메뉴판 썸네일. 사장님 메뉴 편집기에서 업로드(post-images 버킷 재사용).
-- 실행: Supabase SQL Editor에서 이 문장 실행.
ALTER TABLE store_menu_items ADD COLUMN IF NOT EXISTS image_url text;

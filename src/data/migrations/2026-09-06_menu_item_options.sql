-- 메뉴 옵션(무가격 변형: 니트/온더락 등) — 손님이 칩으로 고르면 요청사항으로 주입되어
-- 보드·주방전표·포스 memo에 그대로 표시된다. 실행: Supabase SQL Editor.
ALTER TABLE store_menu_items ADD COLUMN IF NOT EXISTS options text[];

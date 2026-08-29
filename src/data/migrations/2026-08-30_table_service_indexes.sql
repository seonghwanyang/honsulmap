-- 테이블 서비스 핫패스 인덱스 보험 — 이미 있으면 아무 일도 안 함(IF NOT EXISTS).
-- 폴링 쿼리(보드 5초·손님 20초)가 가게 수 늘어도 인덱스 스캔으로 돌게 보장한다.
-- Run in the Supabase SQL Editor.

-- 보드: 오늘 영업분 주문 (spot_id + created_at 범위)
create index if not exists idx_table_orders_spot_created
  on table_orders (spot_id, created_at desc);

-- 손님 내 주문: 세션별 조회
create index if not exists idx_table_orders_session
  on table_orders (session_id, created_at desc);

-- 주문 아이템 join
create index if not exists idx_table_order_items_order
  on table_order_items (order_id);

-- 좌석 점유: 활성 세션만 부분 인덱스
create index if not exists idx_table_sessions_spot_active
  on table_sessions (spot_id) where active;

-- 배치도·메뉴 로드
create index if not exists idx_store_seats_spot on store_seats (spot_id);
create index if not exists idx_store_menu_items_spot on store_menu_items (spot_id, category_id);

NOTIFY pgrst, 'reload schema';

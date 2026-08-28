-- 주문 멱등키 — 네트워크 재시도/재탭으로 같은 주문이 두 번 들어가는 것 방지.
-- 클라이언트가 주문마다 UUID(client_key)를 붙이고, 유니크 인덱스가 중복 insert를
-- 거절하면 API가 기존 주문을 성공으로 재응답한다 (2026-08-30 orders 라우트).
-- Run in the Supabase SQL Editor.

ALTER TABLE table_orders ADD COLUMN IF NOT EXISTS client_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_table_orders_client_key
  ON table_orders (client_key) WHERE client_key IS NOT NULL;

NOTIFY pgrst, 'reload schema';

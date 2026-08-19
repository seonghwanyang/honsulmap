-- 테이블 서비스 v1 전체 스키마 (docs/table-service-v1-spec.md).
-- 사장님이 배치도·메뉴를 직접 편집하고, 손님이 좌석 QR로 체크인·주문하는
-- 멀티테넌트 SaaS의 기반. 한 번 실행으로 S1~S3 테이블 전부 생성.
-- Run in the Supabase SQL Editor.

-- ── 가게별 서비스 설정 ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_table_config (
  spot_id     uuid PRIMARY KEY REFERENCES spots(id) ON DELETE CASCADE,
  enabled     boolean NOT NULL DEFAULT false,
  -- 기능 토글: 소셜 없는 조용한 바는 order만 켜는 식
  modes       jsonb NOT NULL DEFAULT '{"order": true, "social": true, "quest": true, "games": true}',
  live_status text NOT NULL DEFAULT 'open'
              CHECK (live_status IN ('ready', 'open', 'busy', 'full', 'closed')),
  rules_md    text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── 배치도: 구역 + 그리드 좌석 ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_zones (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id   uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  name      text NOT NULL,
  grid_rows int NOT NULL DEFAULT 5 CHECK (grid_rows BETWEEN 1 AND 20),
  grid_cols int NOT NULL DEFAULT 7 CHECK (grid_cols BETWEEN 1 AND 12),
  sort      int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS store_zones_spot_idx ON store_zones (spot_id, sort);

CREATE TABLE IF NOT EXISTS store_seats (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id   uuid NOT NULL REFERENCES store_zones(id) ON DELETE CASCADE,
  -- spot_id 중복 보유: 손님 페이지가 join 없이 spot 단위 한 방 조회
  spot_id   uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  label     text NOT NULL,
  "row"     int NOT NULL,
  col       int NOT NULL,
  seat_type text NOT NULL DEFAULT 'seat' CHECK (seat_type IN ('seat', 'buffer', 'block')),
  active    boolean NOT NULL DEFAULT true,
  UNIQUE (zone_id, "row", col)
);
CREATE INDEX IF NOT EXISTS store_seats_spot_idx ON store_seats (spot_id);

-- ── 체크인 세션 (개인정보는 영업 종료 시 만료·익명화 약속) ─────────
CREATE TABLE IF NOT EXISTS table_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id       uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  seat_id       uuid NOT NULL REFERENCES store_seats(id) ON DELETE CASCADE,
  phone4_hash   text NOT NULL,            -- 재접속 복구 키 (해시만 저장)
  gender        text CHECK (gender IN ('m', 'f')),
  age_band      text,
  mbti          text,
  purpose       text,
  vibe          text,
  tmi           text,
  drink_pref    text,
  is_public     boolean NOT NULL DEFAULT true,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,  -- 혼술맵 계정 연동(선택)
  active        boolean NOT NULL DEFAULT true,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL
);
-- 한 좌석엔 활성 세션 1개
CREATE UNIQUE INDEX IF NOT EXISTS table_sessions_seat_active_uniq
  ON table_sessions (seat_id) WHERE active;
CREATE INDEX IF NOT EXISTS table_sessions_spot_active_idx
  ON table_sessions (spot_id) WHERE active;

-- ── 메뉴 (사장 직접 CRUD, 네이버 임포트는 시드) ────────────────────
CREATE TABLE IF NOT EXISTS store_menu_categories (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  name    text NOT NULL,
  sort    int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS store_menu_categories_spot_idx ON store_menu_categories (spot_id, sort);

CREATE TABLE IF NOT EXISTS store_menu_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES store_menu_categories(id) ON DELETE CASCADE,
  spot_id     uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  name        text NOT NULL,
  price       int NOT NULL DEFAULT 0,      -- 원 단위. ₩0 아이템은 0
  description text,
  image_url   text,
  sold_out    boolean NOT NULL DEFAULT false,
  options     jsonb,                        -- 예: [{"name":"하이볼 변경","price":2000}]
  -- ₩0 인터랙션 아이템 (태그히어 패턴): 호출/추천/신고/익명선물
  zero_action text CHECK (zero_action IN ('call', 'recommend', 'report', 'gift')),
  sort        int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS store_menu_items_spot_idx ON store_menu_items (spot_id, sort);

-- ── 주문 (후불 — 결제 없음, 좌석 합계는 카운터 대조용) ─────────────
CREATE TABLE IF NOT EXISTS table_orders (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id    uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  session_id uuid REFERENCES table_sessions(id) ON DELETE SET NULL,
  seat_label text NOT NULL,                -- 세션 만료 후에도 주문 이력엔 좌석 표시
  status     text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'accepted', 'done', 'canceled')),
  total      int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS table_orders_spot_idx ON table_orders (spot_id, created_at DESC);

CREATE TABLE IF NOT EXISTS table_order_items (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         uuid NOT NULL REFERENCES table_orders(id) ON DELETE CASCADE,
  item_name        text NOT NULL,          -- 주문 시점 스냅샷 (메뉴 수정에 안전)
  price            int NOT NULL DEFAULT 0,
  qty              int NOT NULL DEFAULT 1,
  request          text,
  gift_target_seat text                    -- 익명 선물 대상 좌석
);

-- ── 퀘스트 ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS store_quests (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id    uuid NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  title      text NOT NULL,
  reward     text NOT NULL,
  hidden     boolean NOT NULL DEFAULT false,
  active     boolean NOT NULL DEFAULT true,
  repeat_dow jsonb                          -- 예: [5,6] = 금·토만. null = 매일
);
CREATE INDEX IF NOT EXISTS store_quests_spot_idx ON store_quests (spot_id) WHERE active;

CREATE TABLE IF NOT EXISTS quest_claims (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id   uuid NOT NULL REFERENCES store_quests(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES table_sessions(id) ON DELETE CASCADE,
  status     text NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'rewarded')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quest_id, session_id)
);

-- ── 술게임 (spot_id null = 전 가게 공통 콘텐츠) ────────────────────
CREATE TABLE IF NOT EXISTS drinking_games (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id  uuid REFERENCES spots(id) ON DELETE CASCADE,
  title    text NOT NULL,
  min_p    int NOT NULL DEFAULT 2,
  max_p    int NOT NULL DEFAULT 8,
  tags     text[] NOT NULL DEFAULT '{}',
  rules_md text NOT NULL,
  penalty  text
);

-- ── RLS ────────────────────────────────────────────────────────────
-- 배치도·설정·메뉴·게임 = 손님 페이지가 anon으로 읽음 (공개 정보).
-- 세션·주문·퀘스트클레임 = service-role API 전용 (개인정보/운영 데이터).
ALTER TABLE store_table_config    ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_zones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_seats           ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_sessions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_menu_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_order_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_quests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_claims          ENABLE ROW LEVEL SECURITY;
ALTER TABLE drinking_games        ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'store_table_config', 'store_zones', 'store_seats',
    'store_menu_categories', 'store_menu_items', 'store_quests', 'drinking_games'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_public_read ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_public_read ON %I FOR SELECT TO anon, authenticated USING (true)', t, t
    );
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

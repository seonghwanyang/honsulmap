-- 라이어 게임 (멀티폰 실시간) — 방 코드로 모여 한 명만 다른 정보를 받는
-- 술자리 정번 게임. 상태는 API(서비스롤) 경유 + 클라 2초 폴링으로 동기화.
-- Run in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS game_rooms (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,              -- 4자리 입장 코드
  phase       text NOT NULL DEFAULT 'lobby'
              CHECK (phase IN ('lobby', 'discuss', 'vote', 'liar_guess', 'done')),
  category    text,
  word        text,                              -- 시민에게만 공개 (API가 필터)
  liar_player uuid,
  host_player uuid,
  accused     uuid,                              -- 투표로 지목된 사람
  liar_guess  text,
  winner      text CHECK (winner IN ('liar', 'citizens')),
  round       int  NOT NULL DEFAULT 0,
  spot_id     uuid REFERENCES spots(id) ON DELETE SET NULL,  -- 어느 가게에서 했나 (통계용)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '3 hours'
);
CREATE INDEX IF NOT EXISTS game_rooms_code_idx ON game_rooms (code) WHERE phase != 'done';

CREATE TABLE IF NOT EXISTS game_players (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id   uuid NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
  nick      text NOT NULL,
  vote      uuid,                                -- 이번 라운드에 지목한 플레이어
  is_host   boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, nick)
);
CREATE INDEX IF NOT EXISTS game_players_room_idx ON game_players (room_id);

-- RLS: 전 테이블 API(서비스롤) 전용 — 단어·라이어 정체가 클라 직조회로 새면 안 됨
ALTER TABLE game_rooms   ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_players ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

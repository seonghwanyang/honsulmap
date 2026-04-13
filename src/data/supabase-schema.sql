-- ============================================================
-- Honsulmap Supabase Schema
-- ============================================================

-- Enable UUID extension (already enabled by default in Supabase)
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- spots
CREATE TABLE IF NOT EXISTS spots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  instagram_id    TEXT,
  category        TEXT NOT NULL DEFAULT 'bar'
                    CHECK (category IN ('bar', 'guesthouse', 'pub', 'wine_bar', 'karaoke_bar')),
  region          TEXT NOT NULL
                    CHECK (region IN ('jeju', 'aewol', 'seogwipo', 'east', 'west')),
  address         TEXT NOT NULL,
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  phone           TEXT,
  business_hours  TEXT,
  memo            TEXT,
  naver_place_id  TEXT,
  like_count      INTEGER NOT NULL DEFAULT 0,
  mood_up         INTEGER NOT NULL DEFAULT 0,
  mood_down       INTEGER NOT NULL DEFAULT 0,
  image_urls      TEXT[],
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- stories (Instagram stories scraped per spot)
CREATE TABLE IF NOT EXISTS stories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id       UUID NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  instagram_id  TEXT NOT NULL,
  media_url     TEXT NOT NULL,
  media_type    TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  thumbnail_url TEXT,
  posted_at     TIMESTAMPTZ NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  scraped_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- posts (community board)
CREATE TABLE IF NOT EXISTS posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id       UUID REFERENCES spots(id) ON DELETE SET NULL,
  category      TEXT NOT NULL
                  CHECK (category IN ('status', 'review', 'tip', 'free')),
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  nickname      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  image_urls    TEXT[],
  like_count    INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- comments
CREATE TABLE IF NOT EXISTS comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID REFERENCES posts(id) ON DELETE CASCADE,
  spot_id       UUID REFERENCES spots(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES comments(id) ON DELETE CASCADE,
  nickname      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  content       TEXT NOT NULL,
  like_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Either post_id or spot_id must be set, not both
  CONSTRAINT comment_target_check CHECK (
    (post_id IS NOT NULL AND spot_id IS NULL) OR
    (post_id IS NULL AND spot_id IS NOT NULL)
  ),
  -- Only post comments can have parent_id
  CONSTRAINT comment_reply_check CHECK (
    parent_id IS NULL OR spot_id IS NULL
  )
);

-- likes (fingerprint-based, target polymorphic)
CREATE TABLE IF NOT EXISTS likes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('spot', 'post', 'comment')),
  target_id   UUID NOT NULL,
  fingerprint TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT likes_unique UNIQUE (target_type, target_id, fingerprint)
);

-- mood_votes (분위기 투표)
CREATE TABLE IF NOT EXISTS mood_votes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spot_id     UUID NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
  vote        TEXT NOT NULL CHECK (vote IN ('up', 'down')),
  fingerprint TEXT NOT NULL,

  CONSTRAINT mood_votes_unique UNIQUE (spot_id, fingerprint)
);


-- ============================================================
-- INDEXES
-- ============================================================

-- spots
CREATE INDEX IF NOT EXISTS idx_spots_region    ON spots (region);
CREATE INDEX IF NOT EXISTS idx_spots_category  ON spots (category);
CREATE INDEX IF NOT EXISTS idx_spots_slug      ON spots (slug);

-- stories
CREATE INDEX IF NOT EXISTS idx_stories_spot_id    ON stories (spot_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON stories (expires_at);

-- posts
CREATE INDEX IF NOT EXISTS idx_posts_spot_id    ON posts (spot_id);
CREATE INDEX IF NOT EXISTS idx_posts_category   ON posts (category);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_like_count ON posts (like_count DESC);

-- comments
CREATE INDEX IF NOT EXISTS idx_comments_post_id   ON comments (post_id);
CREATE INDEX IF NOT EXISTS idx_comments_spot_id   ON comments (spot_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments (parent_id);

-- likes
CREATE INDEX IF NOT EXISTS idx_likes_target ON likes (target_type, target_id);

-- mood_votes
CREATE INDEX IF NOT EXISTS idx_mood_votes_spot_id ON mood_votes (spot_id);


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE spots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_votes ENABLE ROW LEVEL SECURITY;

-- ── spots ────────────────────────────────────────────────────
-- anon: read only
CREATE POLICY "spots_select_anon"
  ON spots FOR SELECT
  TO anon
  USING (true);

-- anon: insert/update/delete allowed (API handles business logic)
CREATE POLICY "spots_insert_anon"
  ON spots FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "spots_update_anon"
  ON spots FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- ── stories ──────────────────────────────────────────────────
CREATE POLICY "stories_select_anon"
  ON stories FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "stories_insert_anon"
  ON stories FOR INSERT
  TO anon
  WITH CHECK (true);

-- ── posts ────────────────────────────────────────────────────
CREATE POLICY "posts_select_anon"
  ON posts FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "posts_insert_anon"
  ON posts FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "posts_update_anon"
  ON posts FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "posts_delete_anon"
  ON posts FOR DELETE
  TO anon
  USING (true);

-- ── comments ─────────────────────────────────────────────────
CREATE POLICY "comments_select_anon"
  ON comments FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "comments_insert_anon"
  ON comments FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "comments_update_anon"
  ON comments FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "comments_delete_anon"
  ON comments FOR DELETE
  TO anon
  USING (true);

-- ── likes ────────────────────────────────────────────────────
CREATE POLICY "likes_select_anon"
  ON likes FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "likes_insert_anon"
  ON likes FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "likes_delete_anon"
  ON likes FOR DELETE
  TO anon
  USING (true);

-- ── mood_votes ───────────────────────────────────────────────
CREATE POLICY "mood_votes_select_anon"
  ON mood_votes FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "mood_votes_insert_anon"
  ON mood_votes FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "mood_votes_update_anon"
  ON mood_votes FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "mood_votes_delete_anon"
  ON mood_votes FOR DELETE
  TO anon
  USING (true);


-- ============================================================
-- CONTRIBUTION RANKINGS VIEW
-- ============================================================

CREATE OR REPLACE VIEW contribution_rankings AS
SELECT
  p.nickname,
  COUNT(*)                                          AS post_count,
  COUNT(*) FILTER (WHERE p.category = 'status')    AS status_count,
  COUNT(*) FILTER (WHERE p.category = 'review')    AS review_count,
  COALESCE(SUM(p.like_count), 0)                   AS total_likes,
  COUNT(*) * 10 + COALESCE(SUM(p.like_count), 0) * 2 AS score
FROM posts p
WHERE p.created_at >= now() - INTERVAL '30 days'
GROUP BY p.nickname
ORDER BY score DESC
LIMIT 50;

-- ============================================================
-- Add vibe_tags column to spots
-- ============================================================
-- Free-form vibe tags. For guesthouses we currently use:
--   'party'   — 대형/소규모 파티 게하
--   'quiet'   — 조용/힐링/소규모 소통
--   'general' — 일반 (default)
-- Marker icon dispatch and filter chips read this column.

ALTER TABLE spots ADD COLUMN IF NOT EXISTS vibe_tags TEXT[];

-- Tell PostgREST to reload schema cache so the new column is visible.
NOTIFY pgrst, 'reload schema';

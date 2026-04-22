-- Adds the instagram_media_id column that the scraper upserts on.
-- The column exists in supabase-schema.sql but was never applied to prod,
-- so every story insert returned PGRST204 and silently ended up counted
-- as "0 stories" in the scraper logs. Run this in the Supabase SQL editor.

ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS instagram_media_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS stories_instagram_media_id_unique
  ON stories (instagram_media_id)
  WHERE instagram_media_id IS NOT NULL;

-- Force PostgREST to pick up the new column immediately
NOTIFY pgrst, 'reload schema';

-- Posts URL slug migration: UUID → Korean human-readable slug.
--
-- Adds nullable `slug` column to posts (kept nullable so old rows that
-- haven't been backfilled yet still load), plus a partial unique index so
-- duplicate slugs can't be inserted but NULLs are fine until backfill.
--
-- Run order: apply this migration in the Supabase SQL editor first, then
-- run `tsx scripts/debug/backfill_post_slugs.ts` to populate existing rows.

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS slug text;

-- Partial unique index — only enforces uniqueness when slug is not null,
-- so legacy NULL rows don't collide during the backfill window.
CREATE UNIQUE INDEX IF NOT EXISTS posts_slug_unique_idx
  ON posts (slug)
  WHERE slug IS NOT NULL;

-- Reload PostgREST schema cache so the slug column is queryable via the
-- supabase-js client without restarting.
NOTIFY pgrst, 'reload schema';

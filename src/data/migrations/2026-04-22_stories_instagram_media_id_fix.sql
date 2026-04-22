-- Fix the previous migration. Partial unique indexes (those with a WHERE
-- clause) can't be used as an ON CONFLICT target in Postgres, which is
-- why every upsert still came back as
-- "there is no unique or exclusion constraint matching the ON CONFLICT
-- specification" even after the column was added. Swap for a plain
-- unique index — Postgres treats each NULL as distinct so the column
-- being nullable is fine.

DROP INDEX IF EXISTS stories_instagram_media_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS stories_instagram_media_id_unique
  ON stories (instagram_media_id);

NOTIFY pgrst, 'reload schema';

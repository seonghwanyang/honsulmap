-- Persist Naver Place rating + review count so the spot detail UI can
-- show "★ 4.47 (2,570)" without re-scraping every page load. Both
-- columns are nullable: only ~70% of places report a rating.

ALTER TABLE spots
  ADD COLUMN IF NOT EXISTS naver_rating REAL,
  ADD COLUMN IF NOT EXISTS naver_review_count INTEGER;

NOTIFY pgrst, 'reload schema';

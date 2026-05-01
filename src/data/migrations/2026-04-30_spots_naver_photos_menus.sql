-- Persist Naver Place photo gallery + menu list so the spot detail page
-- can show them without re-scraping per request. Both nullable; not every
-- place has menus (e.g. guesthouses) and some places are still missing
-- photo coverage on Naver.

ALTER TABLE spots
  ADD COLUMN IF NOT EXISTS naver_photos TEXT[],
  ADD COLUMN IF NOT EXISTS naver_menus JSONB;

NOTIFY pgrst, 'reload schema';

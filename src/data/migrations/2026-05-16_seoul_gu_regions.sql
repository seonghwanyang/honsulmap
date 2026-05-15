-- Switch Seoul from 9 권역 buckets to 25 구 administrative districts.
-- Per-spot UPDATEs done by slug since each slug already encodes the
-- correct district. The 2026-05-16_drop_seoul_north.sql migration is
-- redundant once this one runs — both can be applied; this one is the
-- canonical state.
--
-- Run in Supabase SQL Editor. Idempotent (UPDATEs are by slug, CHECK
-- is dropped + re-added).

-- ============================================================
-- 1. Drop old CHECK constraints so the UPDATEs below can land
-- ============================================================

ALTER TABLE spots DROP CONSTRAINT IF EXISTS spots_region_check;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spot_requests'
  ) THEN
    ALTER TABLE spot_requests DROP CONSTRAINT IF EXISTS spot_requests_region_check;
  END IF;
END $$;

-- ============================================================
-- 2. Re-region all Seoul spots by slug (56 rows)
-- ============================================================
-- Mapo (14)
UPDATE spots SET region='mapo' WHERE slug IN (
  '9jeju-hongdae', 'blendingbar-mangwon', 'blendingbar-yeonnam',
  'godo-yeonnam', 'gitteol', 'bar-carousel', 'bar-woowoo',
  'honsul-atlantis', 'tap-shop-bar', 'manpyong', 'turtle-coop',
  'dongkkun', 'baetjang', 'doran-hongdae'
);

-- Gangnam (8)
UPDATE spots SET region='gangnam' WHERE slug IN (
  '9jeju-gangnam', 'yahwa-nonhyeon', 'yahwa-gangnam',
  'yusagil-gangnam-main', 'yusagil-gangnam-2',
  'oullim-seolleung', 'bar-jangsaeng', 'dean-1998'
);

-- Gwanak (6) — includes 9jeju-gurodigital which is at 관악구 조원로
UPDATE spots SET region='gwanak' WHERE slug IN (
  '9jeju-sillim', '9jeju-gurodigital', 'yahwa-sillim',
  'yahwa-seouldae', 'friendsmaru', 'zazak-bar'
);

-- Yongsan (4)
UPDATE spots SET region='yongsan' WHERE slug IN (
  '9jeju-itaewon', 'yahwa-itaewon', 'godo-itaewon', 'southside-parlor'
);

-- Songpa (3)
UPDATE spots SET region='songpa' WHERE slug IN (
  '9jeju-jamsil', 'yahwa-jamsil', 'godo-jamsil'
);

-- Jung (3)
UPDATE spots SET region='jung' WHERE slug IN (
  '9jeju-euljiro', 'yahwa-euljiro', 'gu-seoul'
);

-- Dongjak (3)
UPDATE spots SET region='dongjak' WHERE slug IN (
  '9jeju-sadang', 'yahwa-sadang-isu', 'simsim-noryangjin'
);

-- Yeongdeungpo (3)
UPDATE spots SET region='yeongdeungpo' WHERE slug IN (
  '9jeju-mullae', 'weekendbar', 'mullae-hanjan'
);

-- Gwangjin (3)
UPDATE spots SET region='gwangjin' WHERE slug IN (
  'yahwa-kondae', 'juyeon-bar', 'bar-jebi'
);

-- Singletons
UPDATE spots SET region='seongdong'    WHERE slug = '9jeju-seongsu';
UPDATE spots SET region='gangdong'     WHERE slug = '9jeju-cheonho';
UPDATE spots SET region='gangseo'      WHERE slug = '9jeju-magongnaru';
UPDATE spots SET region='eunpyeong'    WHERE slug = '9jeju-yeonsinnae';
UPDATE spots SET region='seodaemun'    WHERE slug = '9jeju-sinchon';
UPDATE spots SET region='seongbuk'     WHERE slug = '9jeju-sungshin';
UPDATE spots SET region='nowon'        WHERE slug = '9jeju-nowon';
UPDATE spots SET region='guro'         WHERE slug = 'yahwa-guro';
UPDATE spots SET region='jongno'       WHERE slug = 'social-club';

-- Sweep any spot_requests still on old 권역 / seoul_north names so the
-- new CHECK doesn't reject them. Best-guess mapping to most-populated
-- 구 in that 권역.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spot_requests'
  ) THEN
    UPDATE spot_requests SET region='mapo'      WHERE region IN ('hongdae', 'seoul_north');
    UPDATE spot_requests SET region='seongdong' WHERE region = 'seongsu';
  END IF;
END $$;

-- ============================================================
-- 3. Re-add CHECK constraints with the 25 구 vocabulary
-- ============================================================

ALTER TABLE spots ADD CONSTRAINT spots_region_check CHECK (region IN (
  -- Jeju
  'jeju', 'aewol', 'seogwipo', 'east', 'west',
  -- Seoul (25 구)
  'gangnam', 'gangdong', 'gangbuk', 'gangseo', 'gwanak',
  'gwangjin', 'guro', 'geumcheon', 'nowon', 'dobong',
  'dongdaemun', 'dongjak', 'mapo', 'seodaemun', 'seocho',
  'seongdong', 'seongbuk', 'songpa', 'yangcheon', 'yeongdeungpo',
  'yongsan', 'eunpyeong', 'jongno', 'jung', 'jungnang'
));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'spot_requests'
  ) THEN
    ALTER TABLE spot_requests ADD CONSTRAINT spot_requests_region_check CHECK (region IN (
      'jeju', 'aewol', 'seogwipo', 'east', 'west',
      'gangnam', 'gangdong', 'gangbuk', 'gangseo', 'gwanak',
      'gwangjin', 'guro', 'geumcheon', 'nowon', 'dobong',
      'dongdaemun', 'dongjak', 'mapo', 'seodaemun', 'seocho',
      'seongdong', 'seongbuk', 'songpa', 'yangcheon', 'yeongdeungpo',
      'yongsan', 'eunpyeong', 'jongno', 'jung', 'jungnang'
    ));
  END IF;
END $$;

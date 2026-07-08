-- 경기 지역코드 3개 추가: 화성/동탄(gyeonggi_hwaseong) · 성남(gyeonggi_seongnam) ·
-- 의정부(gyeonggi_uijeongbu) — 야화 신규 지점 등록용 (src/lib/types.ts와 동기).
-- spots / spot_requests 두 CHECK를 전체 목록으로 재생성. Run in Supabase SQL Editor.

ALTER TABLE spots DROP CONSTRAINT IF EXISTS spots_region_check;
ALTER TABLE spots
  ADD CONSTRAINT spots_region_check
  CHECK (region IN (
    -- Jeju
    'jeju', 'aewol', 'seogwipo', 'east', 'west',
    -- Seoul (25구)
    'gangnam', 'gangdong', 'gangbuk', 'gangseo', 'gwanak',
    'gwangjin', 'guro', 'geumcheon', 'nowon', 'dobong',
    'dongdaemun', 'dongjak', 'mapo', 'seodaemun', 'seocho',
    'seongdong', 'seongbuk', 'songpa', 'yangcheon', 'yeongdeungpo',
    'yongsan', 'eunpyeong', 'jongno', 'jung', 'jungnang',
    -- Busan
    'busan_jung', 'busan_seo', 'busan_dong', 'busan_yeongdo',
    'busan_busanjin', 'busan_dongnae', 'busan_nam', 'busan_buk',
    'busan_haeundae', 'busan_saha', 'busan_geumjeong', 'busan_gangseo',
    'busan_yeonje', 'busan_suyeong', 'busan_sasang', 'busan_gijang',
    -- Incheon / Daejeon / Gwangju / Daegu
    'incheon_namdong', 'incheon_bupyeong',
    'daejeon_seo', 'daejeon_yuseong',
    'gwangju_seo', 'gwangju_dong',
    'daegu_jung',
    -- Gyeonggi / Chungbuk / Jeonbuk
    'gyeonggi_suwon', 'gyeonggi_ansan', 'gyeonggi_anyang', 'gyeonggi_bucheon', 'gyeonggi_goyang',
    'gyeonggi_hwaseong', 'gyeonggi_seongnam', 'gyeonggi_uijeongbu',
    'chungbuk_cheongju', 'jeonbuk_jeonju'
  ));

-- spot_requests도 동일 목록으로 (제보 폼에서 새 지역 선택 가능해야 함)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'spot_requests') THEN
    ALTER TABLE spot_requests DROP CONSTRAINT IF EXISTS spot_requests_region_check;
    ALTER TABLE spot_requests
      ADD CONSTRAINT spot_requests_region_check
      CHECK (region IN (
        'jeju', 'aewol', 'seogwipo', 'east', 'west',
        'gangnam', 'gangdong', 'gangbuk', 'gangseo', 'gwanak',
        'gwangjin', 'guro', 'geumcheon', 'nowon', 'dobong',
        'dongdaemun', 'dongjak', 'mapo', 'seodaemun', 'seocho',
        'seongdong', 'seongbuk', 'songpa', 'yangcheon', 'yeongdeungpo',
        'yongsan', 'eunpyeong', 'jongno', 'jung', 'jungnang',
        'busan_jung', 'busan_seo', 'busan_dong', 'busan_yeongdo',
        'busan_busanjin', 'busan_dongnae', 'busan_nam', 'busan_buk',
        'busan_haeundae', 'busan_saha', 'busan_geumjeong', 'busan_gangseo',
        'busan_yeonje', 'busan_suyeong', 'busan_sasang', 'busan_gijang',
        'incheon_namdong', 'incheon_bupyeong',
        'daejeon_seo', 'daejeon_yuseong',
        'gwangju_seo', 'gwangju_dong',
        'daegu_jung',
        'gyeonggi_suwon', 'gyeonggi_ansan', 'gyeonggi_anyang', 'gyeonggi_bucheon', 'gyeonggi_goyang',
        'gyeonggi_hwaseong', 'gyeonggi_seongnam', 'gyeonggi_uijeongbu',
        'chungbuk_cheongju', 'jeonbuk_jeonju'
      ));
  END IF;
END $$;

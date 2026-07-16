-- 지역 확장: 경기 시흥/배곧(gyeonggi_siheung) · 경기광주(gyeonggi_gwangju)
--            + 전남 순천(city 'jeonnam' + region 'jeonnam_suncheon')
-- 야화 배곧·경기광주·순천점 등록용 (src/lib/types.ts와 동기).
-- spots_city_check + spots/spot_requests_region_check 를 전체 목록으로 재생성. Run in SQL Editor.

-- 1) city 제약에 jeonnam 추가
ALTER TABLE spots DROP CONSTRAINT IF EXISTS spots_city_check;
ALTER TABLE spots ADD CONSTRAINT spots_city_check CHECK (city IN (
  'jeju', 'seoul', 'busan', 'incheon', 'daejeon',
  'gwangju', 'daegu', 'gyeonggi', 'chungbuk', 'jeonbuk', 'jeonnam'
));

-- 2) region 제약 (spots)
ALTER TABLE spots DROP CONSTRAINT IF EXISTS spots_region_check;
ALTER TABLE spots
  ADD CONSTRAINT spots_region_check
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
    'incheon_namdong', 'incheon_bupyeong', 'incheon_yeonsu', 'incheon_geomdan',
    'daejeon_seo', 'daejeon_yuseong',
    'gwangju_seo', 'gwangju_dong',
    'daegu_jung',
    'gyeonggi_suwon', 'gyeonggi_ansan', 'gyeonggi_anyang', 'gyeonggi_bucheon', 'gyeonggi_goyang',
    'gyeonggi_hwaseong', 'gyeonggi_seongnam', 'gyeonggi_uijeongbu',
    'gyeonggi_pyeongtaek', 'gyeonggi_yongin', 'gyeonggi_hanam', 'gyeonggi_gimpo',
    'gyeonggi_paju', 'gyeonggi_osan', 'gyeonggi_yangju', 'gyeonggi_guri', 'gyeonggi_namyangju',
    'gyeonggi_siheung', 'gyeonggi_gwangju',
    'chungbuk_cheongju', 'jeonbuk_jeonju', 'jeonnam_suncheon'
  ));

-- 3) region 제약 (spot_requests)
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
        'incheon_namdong', 'incheon_bupyeong', 'incheon_yeonsu', 'incheon_geomdan',
        'daejeon_seo', 'daejeon_yuseong',
        'gwangju_seo', 'gwangju_dong',
        'daegu_jung',
        'gyeonggi_suwon', 'gyeonggi_ansan', 'gyeonggi_anyang', 'gyeonggi_bucheon', 'gyeonggi_goyang',
        'gyeonggi_hwaseong', 'gyeonggi_seongnam', 'gyeonggi_uijeongbu',
        'gyeonggi_pyeongtaek', 'gyeonggi_yongin', 'gyeonggi_hanam', 'gyeonggi_gimpo',
        'gyeonggi_paju', 'gyeonggi_osan', 'gyeonggi_yangju', 'gyeonggi_guri', 'gyeonggi_namyangju',
        'gyeonggi_siheung', 'gyeonggi_gwangju',
        'chungbuk_cheongju', 'jeonbuk_jeonju', 'jeonnam_suncheon'
      ));
  END IF;
END $$;

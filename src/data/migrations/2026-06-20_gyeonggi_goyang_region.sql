-- Add the 고양/일산 region (gyeonggi_goyang) so 제주아홉 일산라페스타점 (and future
-- 고양/일산 spots) can land. Keep in lockstep with src/lib/types.ts (Region union
-- + VALID_REGIONS). Region vocab is still the bare-Seoul scheme (retrofit pending).
-- Run in the Supabase SQL Editor.

ALTER TABLE spots DROP CONSTRAINT IF EXISTS spots_region_check;
ALTER TABLE spots ADD CONSTRAINT spots_region_check CHECK (region IN (
  'jeju','aewol','seogwipo','east','west',
  'gangnam','gangdong','gangbuk','gangseo','gwanak','gwangjin','guro','geumcheon',
  'nowon','dobong','dongdaemun','dongjak','mapo','seodaemun','seocho','seongdong',
  'seongbuk','songpa','yangcheon','yeongdeungpo','yongsan','eunpyeong','jongno','jung','jungnang',
  'busan_jung','busan_seo','busan_dong','busan_yeongdo','busan_busanjin','busan_dongnae',
  'busan_nam','busan_buk','busan_haeundae','busan_saha','busan_geumjeong','busan_gangseo',
  'busan_yeonje','busan_suyeong','busan_sasang','busan_gijang',
  'incheon_namdong','incheon_bupyeong','daejeon_seo','daejeon_yuseong',
  'gwangju_seo','gwangju_dong','daegu_jung',
  'gyeonggi_suwon','gyeonggi_ansan','gyeonggi_anyang','gyeonggi_bucheon','gyeonggi_goyang',
  'chungbuk_cheongju','jeonbuk_jeonju'
));

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='spot_requests') THEN
    ALTER TABLE spot_requests DROP CONSTRAINT IF EXISTS spot_requests_region_check;
    ALTER TABLE spot_requests ADD CONSTRAINT spot_requests_region_check CHECK (region IN (
      'jeju','aewol','seogwipo','east','west',
      'gangnam','gangdong','gangbuk','gangseo','gwanak','gwangjin','guro','geumcheon',
      'nowon','dobong','dongdaemun','dongjak','mapo','seodaemun','seocho','seongdong',
      'seongbuk','songpa','yangcheon','yeongdeungpo','yongsan','eunpyeong','jongno','jung','jungnang',
      'busan_jung','busan_seo','busan_dong','busan_yeongdo','busan_busanjin','busan_dongnae',
      'busan_nam','busan_buk','busan_haeundae','busan_saha','busan_geumjeong','busan_gangseo',
      'busan_yeonje','busan_suyeong','busan_sasang','busan_gijang',
      'incheon_namdong','incheon_bupyeong','daejeon_seo','daejeon_yuseong',
      'gwangju_seo','gwangju_dong','daegu_jung',
      'gyeonggi_suwon','gyeonggi_ansan','gyeonggi_anyang','gyeonggi_bucheon','gyeonggi_goyang',
      'chungbuk_cheongju','jeonbuk_jeonju'
    ));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

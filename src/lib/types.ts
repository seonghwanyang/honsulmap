// ===== Database Types =====

export type SpotCategory = 'bar' | 'guesthouse';
export type City =
  | 'jeju' | 'seoul' | 'busan' | 'incheon' | 'daejeon'
  | 'gwangju' | 'daegu' | 'ulsan' | 'sejong' | 'gyeonggi'
  | 'gangwon' | 'chungbuk' | 'chungnam' | 'jeonbuk' | 'jeonnam' | 'gyeongbuk' | 'gyeongnam';
// New cities (Busan onward) carry a `city_` prefix so 구 names like
// 중구/서구 stay globally unique on the shared `region` column. Jeju and
// Seoul keep their legacy bare codes for now — they get retrofitted to
// jeju_*/seoul_* in a later (off-peak) migration. See the 2026-06-01
// prefix-retrofit migration.
export type Region =
  // Jeju (5, legacy bare — retrofit pending)
  | 'jeju' | 'aewol' | 'seogwipo' | 'east' | 'west'
  // Seoul (25 구, legacy bare — retrofit pending)
  | 'gangnam' | 'gangdong' | 'gangbuk' | 'gangseo' | 'gwanak'
  | 'gwangjin' | 'guro' | 'geumcheon' | 'nowon' | 'dobong'
  | 'dongdaemun' | 'dongjak' | 'mapo' | 'seodaemun' | 'seocho'
  | 'seongdong' | 'seongbuk' | 'songpa' | 'yangcheon' | 'yeongdeungpo'
  | 'yongsan' | 'eunpyeong' | 'jongno' | 'jung' | 'jungnang'
  // Busan (16 구·군)
  | 'busan_jung' | 'busan_seo' | 'busan_dong' | 'busan_yeongdo'
  | 'busan_busanjin' | 'busan_dongnae' | 'busan_nam' | 'busan_buk'
  | 'busan_haeundae' | 'busan_saha' | 'busan_geumjeong' | 'busan_gangseo'
  | 'busan_yeonje' | 'busan_suyeong' | 'busan_sasang' | 'busan_gijang'
  // Incheon / Daejeon / Gwangju / Daegu / Ulsan / Sejong (광역시 구 단위)
  | 'incheon_namdong' | 'incheon_bupyeong' | 'incheon_yeonsu' | 'incheon_geomdan'
  | 'incheon_jung' | 'incheon_dong' | 'incheon_michuhol' | 'incheon_gyeyang' | 'incheon_seo'
  | 'daejeon_seo' | 'daejeon_yuseong' | 'daejeon_dong' | 'daejeon_jung' | 'daejeon_daedeok'
  | 'gwangju_seo' | 'gwangju_dong' | 'gwangju_nam' | 'gwangju_buk' | 'gwangju_gwangsan'
  | 'daegu_jung' | 'daegu_dong' | 'daegu_seo' | 'daegu_nam' | 'daegu_buk' | 'daegu_suseong' | 'daegu_dalseo'
  | 'ulsan_jung' | 'ulsan_nam' | 'ulsan_dong' | 'ulsan_buk' | 'ulsan_ulju'
  | 'sejong'
  // Gyeonggi (시 단위) / Chungbuk / Jeonbuk
  | 'gyeonggi_suwon' | 'gyeonggi_ansan' | 'gyeonggi_anyang' | 'gyeonggi_bucheon' | 'gyeonggi_goyang'
  | 'gyeonggi_hwaseong' | 'gyeonggi_seongnam' | 'gyeonggi_uijeongbu'
  | 'gyeonggi_pyeongtaek' | 'gyeonggi_yongin' | 'gyeonggi_hanam' | 'gyeonggi_gimpo'
  | 'gyeonggi_paju' | 'gyeonggi_osan' | 'gyeonggi_yangju' | 'gyeonggi_guri' | 'gyeonggi_namyangju'
  | 'gyeonggi_siheung' | 'gyeonggi_gwangju'
  // Chungbuk / Chungnam (시 단위)
  | 'chungbuk_cheongju' | 'chungbuk_chungju' | 'chungbuk_jecheon'
  | 'chungnam_cheonan' | 'chungnam_asan' | 'chungnam_seosan' | 'chungnam_nonsan' | 'chungnam_dangjin' | 'chungnam_gongju' | 'chungnam_boryeong' | 'chungnam_gyeryong'
  // Jeonbuk / Jeonnam
  | 'jeonbuk_jeonju' | 'jeonbuk_iksan' | 'jeonbuk_gunsan' | 'jeonbuk_jeongeup' | 'jeonbuk_gimje' | 'jeonbuk_namwon'
  | 'jeonnam_suncheon' | 'jeonnam_yeosu' | 'jeonnam_mokpo' | 'jeonnam_gwangyang' | 'jeonnam_naju'
  // Gangwon / Gyeongbuk / Gyeongnam
  | 'gangwon_chuncheon' | 'gangwon_wonju' | 'gangwon_gangneung' | 'gangwon_donghae' | 'gangwon_sokcho' | 'gangwon_samcheok' | 'gangwon_taebaek'
  | 'gyeongbuk_pohang' | 'gyeongbuk_gumi' | 'gyeongbuk_gyeongju' | 'gyeongbuk_gyeongsan' | 'gyeongbuk_andong' | 'gyeongbuk_gimcheon' | 'gyeongbuk_yeongju' | 'gyeongbuk_sangju' | 'gyeongbuk_mungyeong' | 'gyeongbuk_yeongcheon'
  | 'gyeongnam_changwon' | 'gyeongnam_gimhae' | 'gyeongnam_jinju' | 'gyeongnam_yangsan' | 'gyeongnam_geoje' | 'gyeongnam_tongyeong' | 'gyeongnam_sacheon' | 'gyeongnam_miryang';
export type PostCategory = 'status' | 'review' | 'tip' | 'free';
export type MediaType = 'image' | 'video';
export type TargetType = 'spot' | 'post' | 'comment';
export type MoodVoteType = 'up' | 'down';

// 가게별 채팅(#6) 메시지 — API가 표시명/사장님 배지를 해석해 내려준 형태.
// (chat_messages 자체엔 name/is_owner 컬럼이 없음 — 서버가 auth metadata로 해석.)
export interface ChatMessage {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  name: string;
  // 기본은 동물 이모지({emoji,color}), 직접 올린 프사가 있으면 사진({url}).
  avatar: { emoji: string; color: string } | { url: string };
  is_owner: boolean;
  // 클라 전용(낙관적 전송 표시) — 서버는 세팅하지 않음.
  pending?: boolean;
  failed?: boolean;
}

export interface NaverMenuItem {
  name: string;
  price: string | null;
  description: string | null;
  image: string | null;
}

export interface Spot {
  id: string;
  name: string;
  slug: string;
  instagram_id: string | null;
  /** 인스타 프로필 사진을 Supabase Storage(spot-avatars)에 저장한 안정 URL. 마커에 표시. */
  avatar_url?: string | null;
  category: SpotCategory;
  city: City;
  region: Region;
  address: string;
  lat: number;
  lng: number;
  phone: string | null;
  business_hours: string | null;
  memo: string | null;
  benefit_title?: string | null;
  benefit_detail?: string | null;
  benefit_active?: boolean;
  benefit_expires_at?: string | null;
  // 지도 마커 광고 — 미래 시각이면 프리미엄 핀 (클러스터 면제·라벨 상시·AD 배지)
  ad_marker_until?: string | null;
  naver_place_id: string | null;
  naver_rating?: number | null;
  naver_review_count?: number | null;
  naver_photos?: string[] | null;
  naver_menus?: NaverMenuItem[] | null;
  /**
   * Free-form vibe tags. For guesthouses we currently use:
   *   'party' — 대형/소규모 파티 게하
   *   'quiet' — 조용/힐링/소규모 소통
   *   'general' — 일반 (default)
   * Marker icon dispatch and filter chips read this column.
   */
  vibe_tags?: string[] | null;
  like_count: number;
  mood_up: number;
  mood_down: number;
  image_urls: string[] | null;
  created_at: string;
}

export interface Story {
  id: string;
  spot_id: string;
  instagram_id: string;
  media_url: string;
  media_type: MediaType;
  thumbnail_url: string | null;
  posted_at: string;
  expires_at: string;
  scraped_at: string;
}

export interface Post {
  id: string;
  slug: string | null;
  spot_id: string | null;
  category: PostCategory;
  title: string;
  content: string;
  nickname: string;
  password_hash: string;
  image_urls: string[] | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  // joined
  spot?: Spot | null;
}

export interface Comment {
  id: string;
  post_id: string | null;
  spot_id: string | null;
  parent_id: string | null;
  nickname: string;
  password_hash: string;
  content: string;
  like_count: number;
  created_at: string;
  // nested
  replies?: Comment[];
}

export interface Like {
  id: string;
  target_type: TargetType;
  target_id: string;
  fingerprint: string;
  created_at: string;
}

export interface MoodVote {
  id: string;
  spot_id: string;
  vote: MoodVoteType;
  fingerprint: string;
}

export interface ContributionRanking {
  nickname: string;
  post_count: number;
  status_count: number;
  review_count: number;
  total_likes: number;
  score: number;
}

// ===== API Request/Response Types =====

export interface StoryWithSpot extends Story {
  spot: Pick<Spot, 'name' | 'slug' | 'region' | 'category'>;
}

export interface SpotWithStories extends Spot {
  stories: Story[];
  latest_story_at: string | null;
  // 지도 핀 옆 미니 스토리 카드용 — fresh(24h) 최신 스토리 썸네일 (markers API만 채움).
  latest_story_thumb?: string | null;
}

export interface PostCreateRequest {
  category: PostCategory;
  title: string;
  content: string;
  nickname: string;
  password: string;
  spot_id?: string;
  image_urls?: string[];
}

export interface CommentCreateRequest {
  post_id?: string;
  spot_id?: string;
  parent_id?: string;
  nickname: string;
  password: string;
  content: string;
}

// ===== Filter Types =====

export const REGIONS: { value: Region | 'all'; label: string; city?: City }[] = [
  { value: 'all', label: '전체' },
  // Jeju (legacy bare codes — retrofit pending)
  { value: 'jeju', label: '제주시', city: 'jeju' },
  { value: 'aewol', label: '애월', city: 'jeju' },
  { value: 'seogwipo', label: '서귀포', city: 'jeju' },
  { value: 'east', label: '동쪽', city: 'jeju' },
  { value: 'west', label: '서쪽', city: 'jeju' },
  // Seoul (25 구, 가나다순 — legacy bare codes, retrofit pending)
  { value: 'gangnam', label: '강남구', city: 'seoul' },
  { value: 'gangdong', label: '강동구', city: 'seoul' },
  { value: 'gangbuk', label: '강북구', city: 'seoul' },
  { value: 'gangseo', label: '강서구', city: 'seoul' },
  { value: 'gwanak', label: '관악구', city: 'seoul' },
  { value: 'gwangjin', label: '광진구', city: 'seoul' },
  { value: 'guro', label: '구로구', city: 'seoul' },
  { value: 'geumcheon', label: '금천구', city: 'seoul' },
  { value: 'nowon', label: '노원구', city: 'seoul' },
  { value: 'dobong', label: '도봉구', city: 'seoul' },
  { value: 'dongdaemun', label: '동대문구', city: 'seoul' },
  { value: 'dongjak', label: '동작구', city: 'seoul' },
  { value: 'mapo', label: '마포구', city: 'seoul' },
  { value: 'seodaemun', label: '서대문구', city: 'seoul' },
  { value: 'seocho', label: '서초구', city: 'seoul' },
  { value: 'seongdong', label: '성동구', city: 'seoul' },
  { value: 'seongbuk', label: '성북구', city: 'seoul' },
  { value: 'songpa', label: '송파구', city: 'seoul' },
  { value: 'yangcheon', label: '양천구', city: 'seoul' },
  { value: 'yeongdeungpo', label: '영등포구', city: 'seoul' },
  { value: 'yongsan', label: '용산구', city: 'seoul' },
  { value: 'eunpyeong', label: '은평구', city: 'seoul' },
  { value: 'jongno', label: '종로구', city: 'seoul' },
  { value: 'jung', label: '중구', city: 'seoul' },
  { value: 'jungnang', label: '중랑구', city: 'seoul' },
  // Busan (16 구·군, 가나다순)
  { value: 'busan_gangseo', label: '강서구', city: 'busan' },
  { value: 'busan_geumjeong', label: '금정구', city: 'busan' },
  { value: 'busan_gijang', label: '기장군', city: 'busan' },
  { value: 'busan_nam', label: '남구', city: 'busan' },
  { value: 'busan_dong', label: '동구', city: 'busan' },
  { value: 'busan_dongnae', label: '동래구', city: 'busan' },
  { value: 'busan_busanjin', label: '부산진구', city: 'busan' },
  { value: 'busan_buk', label: '북구', city: 'busan' },
  { value: 'busan_sasang', label: '사상구', city: 'busan' },
  { value: 'busan_saha', label: '사하구', city: 'busan' },
  { value: 'busan_seo', label: '서구', city: 'busan' },
  { value: 'busan_suyeong', label: '수영구', city: 'busan' },
  { value: 'busan_yeonje', label: '연제구', city: 'busan' },
  { value: 'busan_yeongdo', label: '영도구', city: 'busan' },
  { value: 'busan_jung', label: '중구', city: 'busan' },
  { value: 'busan_haeundae', label: '해운대구', city: 'busan' },
  // Incheon (8구, 강화/옹진 군 제외)
  { value: 'incheon_jung', label: '중구/영종', city: 'incheon' },
  { value: 'incheon_dong', label: '동구', city: 'incheon' },
  { value: 'incheon_michuhol', label: '미추홀구', city: 'incheon' },
  { value: 'incheon_namdong', label: '남동구', city: 'incheon' },
  { value: 'incheon_bupyeong', label: '부평구', city: 'incheon' },
  { value: 'incheon_gyeyang', label: '계양구', city: 'incheon' },
  { value: 'incheon_seo', label: '서구/청라', city: 'incheon' },
  { value: 'incheon_yeonsu', label: '연수구/송도', city: 'incheon' },
  { value: 'incheon_geomdan', label: '검단구', city: 'incheon' },
  // Daejeon (5구)
  { value: 'daejeon_dong', label: '동구', city: 'daejeon' },
  { value: 'daejeon_jung', label: '중구', city: 'daejeon' },
  { value: 'daejeon_seo', label: '서구', city: 'daejeon' },
  { value: 'daejeon_yuseong', label: '유성구', city: 'daejeon' },
  { value: 'daejeon_daedeok', label: '대덕구', city: 'daejeon' },
  // Gwangju (5구)
  { value: 'gwangju_dong', label: '동구', city: 'gwangju' },
  { value: 'gwangju_seo', label: '서구', city: 'gwangju' },
  { value: 'gwangju_nam', label: '남구', city: 'gwangju' },
  { value: 'gwangju_buk', label: '북구', city: 'gwangju' },
  { value: 'gwangju_gwangsan', label: '광산구', city: 'gwangju' },
  // Daegu (7구, 달성/군위 군 제외)
  { value: 'daegu_jung', label: '중구', city: 'daegu' },
  { value: 'daegu_dong', label: '동구', city: 'daegu' },
  { value: 'daegu_seo', label: '서구', city: 'daegu' },
  { value: 'daegu_nam', label: '남구', city: 'daegu' },
  { value: 'daegu_buk', label: '북구', city: 'daegu' },
  { value: 'daegu_suseong', label: '수성구', city: 'daegu' },
  { value: 'daegu_dalseo', label: '달서구', city: 'daegu' },
  // Ulsan (4구1군)
  { value: 'ulsan_jung', label: '중구', city: 'ulsan' },
  { value: 'ulsan_nam', label: '남구', city: 'ulsan' },
  { value: 'ulsan_dong', label: '동구', city: 'ulsan' },
  { value: 'ulsan_buk', label: '북구', city: 'ulsan' },
  { value: 'ulsan_ulju', label: '울주군', city: 'ulsan' },
  // Sejong
  { value: 'sejong', label: '세종', city: 'sejong' },
  // Gyeonggi (시 단위)
  { value: 'gyeonggi_suwon', label: '수원', city: 'gyeonggi' },
  { value: 'gyeonggi_ansan', label: '안산', city: 'gyeonggi' },
  { value: 'gyeonggi_anyang', label: '안양', city: 'gyeonggi' },
  { value: 'gyeonggi_bucheon', label: '부천', city: 'gyeonggi' },
  { value: 'gyeonggi_goyang', label: '고양/일산', city: 'gyeonggi' },
  { value: 'gyeonggi_hwaseong', label: '화성/동탄', city: 'gyeonggi' },
  { value: 'gyeonggi_seongnam', label: '성남', city: 'gyeonggi' },
  { value: 'gyeonggi_uijeongbu', label: '의정부', city: 'gyeonggi' },
  { value: 'gyeonggi_pyeongtaek', label: '평택', city: 'gyeonggi' },
  { value: 'gyeonggi_yongin', label: '용인', city: 'gyeonggi' },
  { value: 'gyeonggi_hanam', label: '하남', city: 'gyeonggi' },
  { value: 'gyeonggi_gimpo', label: '김포', city: 'gyeonggi' },
  { value: 'gyeonggi_paju', label: '파주', city: 'gyeonggi' },
  { value: 'gyeonggi_osan', label: '오산', city: 'gyeonggi' },
  { value: 'gyeonggi_yangju', label: '양주', city: 'gyeonggi' },
  { value: 'gyeonggi_guri', label: '구리', city: 'gyeonggi' },
  { value: 'gyeonggi_namyangju', label: '남양주/다산', city: 'gyeonggi' },
  { value: 'gyeonggi_siheung', label: '시흥/배곧', city: 'gyeonggi' },
  { value: 'gyeonggi_gwangju', label: '경기광주', city: 'gyeonggi' },
  // Chungbuk
  { value: 'chungbuk_cheongju', label: '청주', city: 'chungbuk' },
  { value: 'chungbuk_chungju', label: '충주', city: 'chungbuk' },
  { value: 'chungbuk_jecheon', label: '제천', city: 'chungbuk' },
  // Chungnam
  { value: 'chungnam_cheonan', label: '천안', city: 'chungnam' },
  { value: 'chungnam_asan', label: '아산', city: 'chungnam' },
  { value: 'chungnam_seosan', label: '서산', city: 'chungnam' },
  { value: 'chungnam_nonsan', label: '논산', city: 'chungnam' },
  { value: 'chungnam_dangjin', label: '당진', city: 'chungnam' },
  { value: 'chungnam_gongju', label: '공주', city: 'chungnam' },
  { value: 'chungnam_boryeong', label: '보령', city: 'chungnam' },
  { value: 'chungnam_gyeryong', label: '계룡', city: 'chungnam' },
  // Jeonbuk
  { value: 'jeonbuk_jeonju', label: '전주', city: 'jeonbuk' },
  { value: 'jeonbuk_iksan', label: '익산', city: 'jeonbuk' },
  { value: 'jeonbuk_gunsan', label: '군산', city: 'jeonbuk' },
  { value: 'jeonbuk_jeongeup', label: '정읍', city: 'jeonbuk' },
  { value: 'jeonbuk_gimje', label: '김제', city: 'jeonbuk' },
  { value: 'jeonbuk_namwon', label: '남원', city: 'jeonbuk' },
  // Jeonnam
  { value: 'jeonnam_suncheon', label: '순천', city: 'jeonnam' },
  { value: 'jeonnam_yeosu', label: '여수', city: 'jeonnam' },
  { value: 'jeonnam_mokpo', label: '목포', city: 'jeonnam' },
  { value: 'jeonnam_gwangyang', label: '광양', city: 'jeonnam' },
  { value: 'jeonnam_naju', label: '나주', city: 'jeonnam' },
  // Gangwon
  { value: 'gangwon_chuncheon', label: '춘천', city: 'gangwon' },
  { value: 'gangwon_wonju', label: '원주', city: 'gangwon' },
  { value: 'gangwon_gangneung', label: '강릉', city: 'gangwon' },
  { value: 'gangwon_donghae', label: '동해', city: 'gangwon' },
  { value: 'gangwon_sokcho', label: '속초', city: 'gangwon' },
  { value: 'gangwon_samcheok', label: '삼척', city: 'gangwon' },
  { value: 'gangwon_taebaek', label: '태백', city: 'gangwon' },
  // Gyeongbuk
  { value: 'gyeongbuk_pohang', label: '포항', city: 'gyeongbuk' },
  { value: 'gyeongbuk_gumi', label: '구미', city: 'gyeongbuk' },
  { value: 'gyeongbuk_gyeongju', label: '경주', city: 'gyeongbuk' },
  { value: 'gyeongbuk_gyeongsan', label: '경산', city: 'gyeongbuk' },
  { value: 'gyeongbuk_andong', label: '안동', city: 'gyeongbuk' },
  { value: 'gyeongbuk_gimcheon', label: '김천', city: 'gyeongbuk' },
  { value: 'gyeongbuk_yeongju', label: '영주', city: 'gyeongbuk' },
  { value: 'gyeongbuk_sangju', label: '상주', city: 'gyeongbuk' },
  { value: 'gyeongbuk_mungyeong', label: '문경', city: 'gyeongbuk' },
  { value: 'gyeongbuk_yeongcheon', label: '영천', city: 'gyeongbuk' },
  // Gyeongnam
  { value: 'gyeongnam_changwon', label: '창원', city: 'gyeongnam' },
  { value: 'gyeongnam_gimhae', label: '김해', city: 'gyeongnam' },
  { value: 'gyeongnam_jinju', label: '진주', city: 'gyeongnam' },
  { value: 'gyeongnam_yangsan', label: '양산', city: 'gyeongnam' },
  { value: 'gyeongnam_geoje', label: '거제', city: 'gyeongnam' },
  { value: 'gyeongnam_tongyeong', label: '통영', city: 'gyeongnam' },
  { value: 'gyeongnam_sacheon', label: '사천', city: 'gyeongnam' },
  { value: 'gyeongnam_miryang', label: '밀양', city: 'gyeongnam' },
];

export const CITIES: { value: City; label: string }[] = [
  { value: 'jeju', label: '제주' },
  { value: 'seoul', label: '서울' },
  { value: 'busan', label: '부산' },
  { value: 'incheon', label: '인천' },
  { value: 'daejeon', label: '대전' },
  { value: 'gwangju', label: '광주' },
  { value: 'daegu', label: '대구' },
  { value: 'ulsan', label: '울산' },
  { value: 'sejong', label: '세종' },
  { value: 'gyeonggi', label: '경기' },
  { value: 'gangwon', label: '강원' },
  { value: 'chungbuk', label: '충북' },
  { value: 'chungnam', label: '충남' },
  { value: 'jeonbuk', label: '전북' },
  { value: 'jeonnam', label: '전남' },
  { value: 'gyeongbuk', label: '경북' },
  { value: 'gyeongnam', label: '경남' },
];

// Source of truth for API validation. Keep in lockstep with the Region
// union and the spots/spot_requests CHECK constraints in the 2026-05-31
// migration.
export const VALID_REGIONS = [
  // Jeju (5, legacy bare — retrofit pending)
  'jeju', 'aewol', 'seogwipo', 'east', 'west',
  // Seoul (25 구, legacy bare — retrofit pending)
  'gangnam', 'gangdong', 'gangbuk', 'gangseo', 'gwanak',
  'gwangjin', 'guro', 'geumcheon', 'nowon', 'dobong',
  'dongdaemun', 'dongjak', 'mapo', 'seodaemun', 'seocho',
  'seongdong', 'seongbuk', 'songpa', 'yangcheon', 'yeongdeungpo',
  'yongsan', 'eunpyeong', 'jongno', 'jung', 'jungnang',
  // Busan (16 구·군)
  'busan_jung', 'busan_seo', 'busan_dong', 'busan_yeongdo',
  'busan_busanjin', 'busan_dongnae', 'busan_nam', 'busan_buk',
  'busan_haeundae', 'busan_saha', 'busan_geumjeong', 'busan_gangseo',
  'busan_yeonje', 'busan_suyeong', 'busan_sasang', 'busan_gijang',
  // Incheon / Daejeon / Gwangju / Daegu / Ulsan / Sejong (광역시 구)
  'incheon_namdong', 'incheon_bupyeong', 'incheon_yeonsu', 'incheon_geomdan',
  'incheon_jung', 'incheon_dong', 'incheon_michuhol', 'incheon_gyeyang', 'incheon_seo',
  'daejeon_seo', 'daejeon_yuseong', 'daejeon_dong', 'daejeon_jung', 'daejeon_daedeok',
  'gwangju_seo', 'gwangju_dong', 'gwangju_nam', 'gwangju_buk', 'gwangju_gwangsan',
  'daegu_jung', 'daegu_dong', 'daegu_seo', 'daegu_nam', 'daegu_buk', 'daegu_suseong', 'daegu_dalseo',
  'ulsan_jung', 'ulsan_nam', 'ulsan_dong', 'ulsan_buk', 'ulsan_ulju',
  'sejong',
  // Gyeonggi (시 단위) / Chungbuk / Jeonbuk
  'gyeonggi_suwon', 'gyeonggi_ansan', 'gyeonggi_anyang', 'gyeonggi_bucheon', 'gyeonggi_goyang',
  'gyeonggi_hwaseong', 'gyeonggi_seongnam', 'gyeonggi_uijeongbu',
  'gyeonggi_pyeongtaek', 'gyeonggi_yongin', 'gyeonggi_hanam', 'gyeonggi_gimpo',
  'gyeonggi_paju', 'gyeonggi_osan', 'gyeonggi_yangju', 'gyeonggi_guri', 'gyeonggi_namyangju',
  'gyeonggi_siheung', 'gyeonggi_gwangju',
  // Chungbuk / Chungnam
  'chungbuk_cheongju', 'chungbuk_chungju', 'chungbuk_jecheon',
  'chungnam_cheonan', 'chungnam_asan', 'chungnam_seosan', 'chungnam_nonsan', 'chungnam_dangjin', 'chungnam_gongju', 'chungnam_boryeong', 'chungnam_gyeryong',
  // Jeonbuk / Jeonnam
  'jeonbuk_jeonju', 'jeonbuk_iksan', 'jeonbuk_gunsan', 'jeonbuk_jeongeup', 'jeonbuk_gimje', 'jeonbuk_namwon',
  'jeonnam_suncheon', 'jeonnam_yeosu', 'jeonnam_mokpo', 'jeonnam_gwangyang', 'jeonnam_naju',
  // Gangwon / Gyeongbuk / Gyeongnam
  'gangwon_chuncheon', 'gangwon_wonju', 'gangwon_gangneung', 'gangwon_donghae', 'gangwon_sokcho', 'gangwon_samcheok', 'gangwon_taebaek',
  'gyeongbuk_pohang', 'gyeongbuk_gumi', 'gyeongbuk_gyeongju', 'gyeongbuk_gyeongsan', 'gyeongbuk_andong', 'gyeongbuk_gimcheon', 'gyeongbuk_yeongju', 'gyeongbuk_sangju', 'gyeongbuk_mungyeong', 'gyeongbuk_yeongcheon',
  'gyeongnam_changwon', 'gyeongnam_gimhae', 'gyeongnam_jinju', 'gyeongnam_yangsan', 'gyeongnam_geoje', 'gyeongnam_tongyeong', 'gyeongnam_sacheon', 'gyeongnam_miryang',
] as const satisfies readonly Region[];

export const VALID_CITIES = [
  'jeju', 'seoul', 'busan', 'incheon', 'daejeon',
  'gwangju', 'daegu', 'ulsan', 'sejong', 'gyeonggi',
  'gangwon', 'chungbuk', 'chungnam', 'jeonbuk', 'jeonnam', 'gyeongbuk', 'gyeongnam',
] as const satisfies readonly City[];

export const POST_CATEGORIES: { value: PostCategory | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'status', label: '현황' },
  { value: 'review', label: '후기' },
  { value: 'tip', label: '꿀팁' },
  { value: 'free', label: '자유' },
];

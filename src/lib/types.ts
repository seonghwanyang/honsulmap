// ===== Database Types =====

export type SpotCategory = 'bar' | 'guesthouse';
export type City =
  | 'jeju' | 'seoul' | 'busan' | 'incheon' | 'daejeon'
  | 'gwangju' | 'daegu' | 'gyeonggi' | 'chungbuk' | 'jeonbuk';
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
  // Incheon / Daejeon / Gwangju / Daegu
  | 'incheon_namdong' | 'incheon_bupyeong'
  | 'daejeon_seo' | 'daejeon_yuseong'
  | 'gwangju_seo' | 'gwangju_dong'
  | 'daegu_jung'
  // Gyeonggi (시 단위) / Chungbuk / Jeonbuk
  | 'gyeonggi_suwon' | 'gyeonggi_ansan' | 'gyeonggi_anyang' | 'gyeonggi_bucheon' | 'gyeonggi_goyang'
  | 'chungbuk_cheongju' | 'jeonbuk_jeonju';
export type PostCategory = 'status' | 'review' | 'tip' | 'free';
export type MediaType = 'image' | 'video';
export type TargetType = 'spot' | 'post' | 'comment';
export type MoodVoteType = 'up' | 'down';

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
  // Incheon
  { value: 'incheon_namdong', label: '남동구', city: 'incheon' },
  { value: 'incheon_bupyeong', label: '부평구', city: 'incheon' },
  // Daejeon
  { value: 'daejeon_seo', label: '서구', city: 'daejeon' },
  { value: 'daejeon_yuseong', label: '유성구', city: 'daejeon' },
  // Gwangju
  { value: 'gwangju_seo', label: '서구', city: 'gwangju' },
  { value: 'gwangju_dong', label: '동구', city: 'gwangju' },
  // Daegu
  { value: 'daegu_jung', label: '중구', city: 'daegu' },
  // Gyeonggi (시 단위)
  { value: 'gyeonggi_suwon', label: '수원', city: 'gyeonggi' },
  { value: 'gyeonggi_ansan', label: '안산', city: 'gyeonggi' },
  { value: 'gyeonggi_anyang', label: '안양', city: 'gyeonggi' },
  { value: 'gyeonggi_bucheon', label: '부천', city: 'gyeonggi' },
  { value: 'gyeonggi_goyang', label: '고양/일산', city: 'gyeonggi' },
  // Chungbuk / Jeonbuk
  { value: 'chungbuk_cheongju', label: '청주', city: 'chungbuk' },
  { value: 'jeonbuk_jeonju', label: '전주', city: 'jeonbuk' },
];

export const CITIES: { value: City; label: string }[] = [
  { value: 'jeju', label: '제주' },
  { value: 'seoul', label: '서울' },
  { value: 'busan', label: '부산' },
  { value: 'incheon', label: '인천' },
  { value: 'daejeon', label: '대전' },
  { value: 'gwangju', label: '광주' },
  { value: 'daegu', label: '대구' },
  { value: 'gyeonggi', label: '경기' },
  { value: 'chungbuk', label: '충북' },
  { value: 'jeonbuk', label: '전북' },
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
  // Incheon / Daejeon / Gwangju / Daegu
  'incheon_namdong', 'incheon_bupyeong',
  'daejeon_seo', 'daejeon_yuseong',
  'gwangju_seo', 'gwangju_dong',
  'daegu_jung',
  // Gyeonggi (시 단위) / Chungbuk / Jeonbuk
  'gyeonggi_suwon', 'gyeonggi_ansan', 'gyeonggi_anyang', 'gyeonggi_bucheon', 'gyeonggi_goyang',
  'chungbuk_cheongju', 'jeonbuk_jeonju',
] as const satisfies readonly Region[];

export const VALID_CITIES = [
  'jeju', 'seoul', 'busan', 'incheon', 'daejeon',
  'gwangju', 'daegu', 'gyeonggi', 'chungbuk', 'jeonbuk',
] as const satisfies readonly City[];

export const POST_CATEGORIES: { value: PostCategory | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'status', label: '현황' },
  { value: 'review', label: '후기' },
  { value: 'tip', label: '꿀팁' },
  { value: 'free', label: '자유' },
];

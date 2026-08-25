// 상권(商圈) 단일 소스 — SEO 지역 트리(도시 > 구/시 > 상권)의 상권 정의.
// 가게는 좌표(lat/lng) 최근접 매칭으로 상권에 배정된다 (DB 컬럼 없음, 순수 계산).
// 2026-08-25 실측 기준: 반경 내 5곳 이상인 상권만 등록. 좌표는 역/중심지 근사치.
//
// mode:
//  - 'page'           → /region/[city]/[district]/[slug] 전용 페이지 생성
//  - 'district-title' → 상권이 구 전체와 사실상 동일 — 별도 페이지 대신
//                       구 페이지의 제목/H1에 상권명을 사용 (중복 페이지 방지)
import { REGIONS } from './types';
import type { City, Region } from './types';
import { haversineMeters } from './utils';

export interface Area {
  slug: string;
  label: string;
  /** 검색 별칭 — 인트로/설명문에 노출해 키워드 커버 ("홍대입구" 등) */
  aliases: string[];
  city: City;
  district: Region;
  lat: number;
  lng: number;
  /** 이 반경(m) 밖의 가게는 배정하지 않음 */
  maxR: number;
  mode: 'page' | 'district-title';
}

/** 구/시·상권 페이지 생성 최소 가게 수 — 미만이면 부모 페이지 섹션으로만 노출 */
export const MIN_PAGE_SPOTS = 5;

export const AREAS: Area[] = [
  // ---- 서울 ----
  { slug: 'hongdae', label: '홍대', aliases: ['홍대입구', '홍익대'], city: 'seoul', district: 'mapo', lat: 37.5572, lng: 126.9245, maxR: 1000, mode: 'page' },
  { slug: 'yeonnam', label: '연남동', aliases: ['연트럴파크'], city: 'seoul', district: 'mapo', lat: 37.5623, lng: 126.9255, maxR: 600, mode: 'page' },
  { slug: 'hapjeong', label: '합정·망원', aliases: ['합정역', '망원동'], city: 'seoul', district: 'mapo', lat: 37.5520, lng: 126.9120, maxR: 900, mode: 'page' },
  { slug: 'sillim', label: '신림', aliases: ['신림역', '서울대입구'], city: 'seoul', district: 'gwanak', lat: 37.4842, lng: 126.9297, maxR: 800, mode: 'page' },
  { slug: 'euljiro', label: '을지로', aliases: ['을지로3가', '힙지로'], city: 'seoul', district: 'jung', lat: 37.5663, lng: 126.9910, maxR: 700, mode: 'page' },
  { slug: 'gangnam-station', label: '강남역', aliases: ['강남', '역삼'], city: 'seoul', district: 'gangnam', lat: 37.4979, lng: 127.0276, maxR: 900, mode: 'page' },
  { slug: 'geondae', label: '건대', aliases: ['건대입구', '건국대'], city: 'seoul', district: 'gwangjin', lat: 37.5404, lng: 127.0693, maxR: 800, mode: 'page' },
  { slug: 'seongsu', label: '성수', aliases: ['성수동', '뚝섬'], city: 'seoul', district: 'seongdong', lat: 37.5446, lng: 127.0559, maxR: 900, mode: 'district-title' },
  { slug: 'itaewon', label: '이태원·한남', aliases: ['이태원역', '한남동'], city: 'seoul', district: 'yongsan', lat: 37.5345, lng: 126.9946, maxR: 1100, mode: 'district-title' },
  { slug: 'mullae', label: '영등포·문래', aliases: ['문래동', '문래창작촌'], city: 'seoul', district: 'yeongdeungpo', lat: 37.5173, lng: 126.8990, maxR: 1000, mode: 'district-title' },
  // ---- 부산 ----
  { slug: 'seomyeon', label: '서면', aliases: ['서면역'], city: 'busan', district: 'busan_busanjin', lat: 35.1578, lng: 129.0595, maxR: 800, mode: 'page' },
  { slug: 'jeonpo', label: '전포', aliases: ['전포동', '전포카페거리'], city: 'busan', district: 'busan_busanjin', lat: 35.1530, lng: 129.0637, maxR: 500, mode: 'page' },
  { slug: 'gwangalli', label: '광안리', aliases: ['광안리해수욕장', '광안동'], city: 'busan', district: 'busan_suyeong', lat: 35.1532, lng: 129.1187, maxR: 1200, mode: 'district-title' },
  // ---- 대구 / 광주 ----
  { slug: 'dongseongno', label: '동성로', aliases: ['대구 시내', '중앙로'], city: 'daegu', district: 'daegu_jung', lat: 35.8690, lng: 128.5946, maxR: 900, mode: 'district-title' },
  { slug: 'dongmyeong', label: '동명동·충장로', aliases: ['동리단길'], city: 'gwangju', district: 'gwangju_dong', lat: 35.1480, lng: 126.9190, maxR: 1000, mode: 'district-title' },
  // ---- 경기 ----
  { slug: 'ingye', label: '인계동', aliases: ['수원시청', '나혜석거리'], city: 'gyeonggi', district: 'gyeonggi_suwon', lat: 37.2640, lng: 127.0300, maxR: 900, mode: 'page' },
];

/** 카테고리 구성에 맞는 표기 — 제주권은 게스트하우스 혼합 */
export function spotTypeWord(spots: { category: string }[]): string {
  const hasBar = spots.some((s) => s.category === 'bar');
  const hasGh = spots.some((s) => s.category === 'guesthouse');
  if (hasBar && hasGh) return '혼술바·파티 게스트하우스';
  if (hasGh) return '파티 게스트하우스';
  return '혼술바';
}

/** REGIONS에서 (city, region) 라벨 조회 */
export function districtLabel(city: City, district: Region): string {
  return REGIONS.find((r) => r.value === district && r.city === city)?.label ?? district;
}

/** region 코드 → URL 조각. city 접두어(busan_ 등)를 벗겨 짧게 쓴다. */
export function districtToUrlSlug(city: City, district: Region): string {
  const prefix = `${city}_`;
  return district.startsWith(prefix) ? district.slice(prefix.length) : district;
}

/** URL 조각 → region 코드 역변환. 해당 city에 실존하는 region만 인정. */
export function districtFromUrlSlug(city: City, slug: string): Region | null {
  const candidates = [slug, `${city}_${slug}`];
  const hit = REGIONS.find(
    (r) => r.city === city && candidates.includes(r.value as string),
  );
  return (hit?.value as Region) ?? null;
}

/**
 * 가게를 상권에 배정 — 등록된 모든 상권 중 maxR 이내에서 가장 가까운 곳.
 * (page/district-title 모두 배정 경쟁에 참여시켜, 인접 상권끼리 가게를
 * 뺏어가는 왜곡을 막는다.)
 */
export function assignArea(spot: { lat: number; lng: number }): Area | null {
  let best: Area | null = null;
  let bestDist = Infinity;
  for (const a of AREAS) {
    const d = haversineMeters(spot.lat, spot.lng, a.lat, a.lng);
    if (d <= a.maxR && d < bestDist) {
      best = a;
      bestDist = d;
    }
  }
  return best;
}

/** 구 페이지 제목을 대신할 상권 (mode: district-title) */
export function titleAreaOf(city: City, district: Region): Area | null {
  return (
    AREAS.find(
      (a) => a.city === city && a.district === district && a.mode === 'district-title',
    ) ?? null
  );
}

/** 해당 구 아래 전용 페이지 상권 목록 (mode: page) */
export function pageAreasOf(city: City, district: Region): Area[] {
  return AREAS.filter(
    (a) => a.city === city && a.district === district && a.mode === 'page',
  );
}

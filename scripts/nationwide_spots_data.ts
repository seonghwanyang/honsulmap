// Nationwide bar spot list — IG-verified spots from
// docs/전국_혼술바_통합.xlsx. Every handle here was confirmed live against
// IG's web_profile_info (full_name + bio matched the venue) — nothing is
// guessed. Handles that couldn't be verified (rate-limited or no bio
// evidence) are intentionally omitted and tracked separately.
//
// Spans multiple cities, so each row carries its own city + region.
// lat/lng are coarse region centroids; naver_map_resync_city.py rewrites
// them with exact Naver place coords after import.

import type { City, Region } from '../src/lib/types';

export interface NationwideSpot {
  name: string;
  slug: string;
  instagram_id: string;
  city: City;
  region: Region;
  address: string;
  memo: string;
}

// Coarse centroids per region used below (pre-resync placeholder).
export const REGION_CENTROID: Partial<Record<Region, [number, number]>> = {
  incheon_bupyeong: [37.4894, 126.7246],   // 부평역
  daejeon_seo: [36.3515, 127.3780],        // 둔산
  daejeon_yuseong: [36.3540, 127.3380],    // 봉명동
  gwangju_seo: [35.1520, 126.8730],        // 화정/염주
  daegu_jung: [35.8693, 128.5957],         // 동성로
  gyeonggi_suwon: [37.2730, 126.9750],     // 수원 금곡동
  gyeonggi_ansan: [37.3090, 126.8390],     // 안산 고잔동
  gyeonggi_bucheon: [37.5036, 126.7660],   // 부천 신중동
  chungbuk_cheongju: [36.6630, 127.4830],  // 청주 율량동
  jeonbuk_jeonju: [35.8160, 127.1480],     // 전주 객리단길
};

export const NATIONWIDE_SPOTS: NationwideSpot[] = [
  // ── 인천 ──────────────────────────────────────────────────
  {
    name: '다수결',
    slug: 'dasugyeol-bupyeong',
    instagram_id: 'majority_rule_',
    city: 'incheon',
    region: 'incheon_bupyeong',
    address: '인천 부평구 평리단길',
    memo: '인천 최초의 소셜링 펍. 부평 평리단길.',
  },
  // ── 대전 ──────────────────────────────────────────────────
  {
    name: '제주아홉 대전점',
    slug: '9jeju-daejeon',
    instagram_id: '9_jeju7',
    city: 'daejeon',
    region: 'daejeon_seo',
    address: '대전 서구 둔산동 1049',
    memo: '대전 최초 혼술의 성지. 둔산동. 제주아홉 7호점. 워크인.',
  },
  {
    name: '블렌딩바 봉명',
    slug: 'blendingbar-bongmyeong',
    instagram_id: 'blending_bar_bongmyeong',
    city: 'daejeon',
    region: 'daejeon_yuseong',
    address: '대전 유성구 봉명동',
    memo: '서울 망원 본점에서 파생된 대전 봉명동 지점.',
  },
  // ── 광주 ──────────────────────────────────────────────────
  {
    name: '심심미학',
    slug: 'simsimmihak-gwangju',
    instagram_id: 'simsimmihak',
    city: 'gwangju',
    region: 'gwangju_seo',
    address: '광주 서구 염화로65번길 8',
    memo: '광주 서구 위스키바. 혼자 와도 함께하는 광주혼술.',
  },
  // ── 대구 ──────────────────────────────────────────────────
  {
    name: '제주아홉 대구점',
    slug: '9jeju-daegu',
    instagram_id: '9_jeju11',
    city: 'daegu',
    region: 'daegu_jung',
    address: '대구 중구 동성로',
    memo: '대구 동성로 혼술바. 제주아홉 파생.',
  },
  {
    name: '블렌딩바 대구',
    slug: 'blendingbar-daegu',
    instagram_id: 'blending_bar_daegu',
    city: 'daegu',
    region: 'daegu_jung',
    address: '대구 중구 교동',
    memo: '서울 망원 본점에서 파생된 대구 교동 지점.',
  },
  // ── 경기 ──────────────────────────────────────────────────
  {
    name: '수원 혼술남녀',
    slug: 'honsulnamnyeo-suwon',
    instagram_id: 'hon.sley',
    city: 'gyeonggi',
    region: 'gyeonggi_suwon',
    address: '경기 수원시 금곡동',
    memo: '수원 금곡동 8석 작은 혼술 공간. 혼자지만 혼자가 아닌 시간.',
  },
  {
    name: '이리',
    slug: 'iri-ansan',
    instagram_id: 'iri_ansan',
    city: 'gyeonggi',
    region: 'gyeonggi_ansan',
    address: '경기 안산시 고잔동',
    memo: '안산 고잔동 혼술바. 혼자 와도 둘이 와도 환영.',
  },
  {
    name: '고도 부천점',
    slug: 'godo-bucheon',
    instagram_id: 'godo_bucheon',
    city: 'gyeonggi',
    region: 'gyeonggi_bucheon',
    address: '경기 부천시 신중동',
    memo: '제주 본점에서 파생. 부천 신중동 혼술바. 20:00~04:00.',
  },
  {
    name: '흔들',
    slug: 'heundle-bucheon',
    instagram_id: 'heundle.bar',
    city: 'gyeonggi',
    region: 'gyeonggi_bucheon',
    address: '경기 부천시 상동 소향로37번길 19',
    memo: '부천 상동 혼술바. 매일 20:00~03:00. 안주 반입 가능.',
  },
  // ── 청주 (충북) ───────────────────────────────────────────
  {
    name: '제주아홉 청주점',
    slug: '9jeju-cheongju',
    instagram_id: '9_jeju3',
    city: 'chungbuk',
    region: 'chungbuk_cheongju',
    address: '충북 청주시 율량동 2041',
    memo: '제주아홉 육지 1호점. 청주 율량동. 워크인.',
  },
  {
    name: '자유의견_Bar',
    slug: 'jayuuigyeon-cheongju',
    instagram_id: 'free_cocktails',
    city: 'chungbuk',
    region: 'chungbuk_cheongju',
    address: '충북 청주시 충대로 9',
    memo: '청주 충대로 혼술 이벤트바. 모두가 함께하는 편안한 공간. 20:00~03:00.',
  },
  // ── 전주 (전북) ───────────────────────────────────────────
  {
    name: '블렌딩바 전주',
    slug: 'blendingbar-jeonju',
    instagram_id: 'blending_bar_jeonju',
    city: 'jeonbuk',
    region: 'jeonbuk_jeonju',
    address: '전북 전주시 객리단길',
    memo: '서울 망원 본점에서 파생된 전주 객리단길 지점.',
  },
];

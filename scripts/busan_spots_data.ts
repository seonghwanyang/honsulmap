// Busan bar spot list — assembled from docs/부산_혼술바_인스타 (2).xlsx.
//
// 14 spots total: 8 with confirmed IG handles (seeded here), 6 flagged
// "검색 필요" in the sheet (added later once handles resolve). `region`
// is the spot's actual 구 with a `busan_` prefix (the bare 구 names
// collide with Seoul on the shared region column).
//
// lat/lng are coarse 구 centroids; naver_map_resync_busan.py rewrites
// them with exact Naver place coords after import.

export type BusanRegion =
  | 'busan_jung' | 'busan_seo' | 'busan_dong' | 'busan_yeongdo'
  | 'busan_busanjin' | 'busan_dongnae' | 'busan_nam' | 'busan_buk'
  | 'busan_haeundae' | 'busan_saha' | 'busan_geumjeong' | 'busan_gangseo'
  | 'busan_yeonje' | 'busan_suyeong' | 'busan_sasang' | 'busan_gijang';

export interface BusanSpot {
  name: string;
  slug: string;
  instagram_id: string | null;
  region: BusanRegion;
  address: string;
  memo: string | null;
}

// 구 centroids — coarse placeholder lat/lng before naver_map_resync runs.
// Only the 구 we currently have data for are filled in; the rest fall
// back to 부산시청 (연제구) via DEFAULT_CENTER.
const DEFAULT_CENTER: [number, number] = [35.1796, 129.0756]; // 부산시청
export const REGION_CENTROID: Record<BusanRegion, [number, number]> = {
  busan_jung: DEFAULT_CENTER,
  busan_seo: DEFAULT_CENTER,
  busan_dong: DEFAULT_CENTER,
  busan_yeongdo: DEFAULT_CENTER,
  busan_busanjin: [35.1578, 129.0596],   // 서면역
  busan_dongnae: DEFAULT_CENTER,
  busan_nam: DEFAULT_CENTER,
  busan_buk: DEFAULT_CENTER,
  busan_haeundae: [35.1587, 129.1604],   // 해운대해수욕장
  busan_saha: DEFAULT_CENTER,
  busan_geumjeong: DEFAULT_CENTER,
  busan_gangseo: DEFAULT_CENTER,
  busan_yeonje: DEFAULT_CENTER,
  busan_suyeong: [35.1532, 129.1187],    // 광안리해수욕장
  busan_sasang: DEFAULT_CENTER,
  busan_gijang: DEFAULT_CENTER,
};

export const BUSAN_SPOTS: BusanSpot[] = [
  // ── 광안리 (수영구) ──────────────────────────────────────────
  {
    name: '제주아홉 광안리점',
    slug: '9jeju-gwangalli',
    instagram_id: '9_jeju6',
    region: 'busan_suyeong',
    address: '부산 수영구 광안리',
    memo: '제주 본점에서 파생된 광안리 혼술바.',
  },
  {
    name: '곁 부산광안리점',
    slug: 'gyut-gwangalli',
    instagram_id: 'jeju.gyut_busan.gwangalli',
    region: 'busan_suyeong',
    address: '부산 수영구 광안리',
    memo: '제주 본점 @gyut_jeju 파생 / 2024.08 오픈.',
  },
  {
    name: '블렌딩바 광안리',
    slug: 'blendingbar-gwangalli',
    instagram_id: 'blending_bar_gwanganri',
    region: 'busan_suyeong',
    address: '부산 수영구 광안리',
    memo: '서울 망원 본점에서 파생된 광안리 지점.',
  },
  {
    name: '주인 (Drinkus)',
    slug: 'juin-drinkus',
    instagram_id: 'drinkus_busan',
    region: 'busan_suyeong',
    address: '부산 수영구 광안리',
    memo: '광안리 혼술바.',
  },
  {
    name: '로카벨',
    slug: 'locavel-gwangalli',
    instagram_id: 'locavel.gwangalli',
    region: 'busan_suyeong',
    address: '부산 수영구 광안리',
    memo: '광안리 오션뷰 혼술바.',
  },
  {
    name: '광안리 해파리',
    slug: 'haepari-gwangalli',
    instagram_id: 'haepari_busan',
    region: 'busan_suyeong',
    address: '부산 수영구 광안리',
    memo: '혼자여도 여럿이어도 친구가 될 수 있는 공간.',
  },
  {
    name: '미옥',
    slug: 'miok-gwangalli',
    instagram_id: 'miok___8253',
    region: 'busan_suyeong',
    address: '부산 수영구 광안리',
    memo: '부산 광안리 혼술바.',
  },
  // ── 서면 (부산진구) ──────────────────────────────────────────
  {
    name: '블렌딩바 서면',
    slug: 'blendingbar-seomyeon',
    instagram_id: 'blending_bar_seomyeon',
    region: 'busan_busanjin',
    address: '부산 부산진구 서면',
    memo: '서울 망원 본점에서 파생된 서면 지점.',
  },
];

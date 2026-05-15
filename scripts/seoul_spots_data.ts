// Seoul bar spot list — assembled from seoul_honsulbar.xlsx (47 rows,
// post-dedup of 관악점=구로디지털점) + 9jeju.com official branch list
// (7 bonus Seoul branches not in xlsx) + 고도 잠실 (user-provided) +
// 3 discovery hits (bar_jebi / mullae_hanjan / doran_hongdae) + 블렌딩
// 연남 = 56 spots.
//
// lat/lng are seeded from the region's centroid; naver_map_resync.py
// then walks each spot, searches Naver Map, and rewrites the row with
// the exact place_id / lat / lng / road address.

export type SeoulRegion =
  | 'gangnam' | 'songpa' | 'hongdae' | 'yongsan' | 'seongsu'
  | 'jongno' | 'yeongdeungpo' | 'gwanak';

export interface SeoulSpot {
  name: string;
  slug: string;
  instagram_id: string | null;
  region: SeoulRegion;
  address: string;
  memo: string | null;
}

// 권역 centroids — placeholder lat/lng before naver_map_resync runs.
export const REGION_CENTROID: Record<SeoulRegion, [number, number]> = {
  gangnam: [37.4979, 127.0276],       // 강남역
  songpa: [37.5145, 127.1058],         // 잠실역
  hongdae: [37.5563, 126.9234],        // 홍대입구
  yongsan: [37.5345, 126.9947],        // 이태원역
  seongsu: [37.5443, 127.0557],        // 성수역
  jongno: [37.5704, 126.9826],         // 광화문
  yeongdeungpo: [37.5260, 126.8964],   // 영등포역
  gwanak: [37.4838, 126.9295],         // 서울대입구역
};

export const SEOUL_SPOTS: SeoulSpot[] = [
  // ── 제주아홉 (16개 서울 지점) ───────────────────────────────
  { name: '제주아홉 홍대점', slug: '9jeju-hongdae', instagram_id: '9_jeju4', region: 'hongdae', address: '서울 마포구 동교로38안길 7', memo: '대한민국 최초 프랜차이즈 혼술바' },
  { name: '제주아홉 성수점', slug: '9jeju-seongsu', instagram_id: '9_jeju5', region: 'seongsu', address: '서울 성동구 왕십리로4길 26-14', memo: '20:00-04:00' },
  { name: '제주아홉 신림점', slug: '9jeju-sillim', instagram_id: '9_jeju8', region: 'gwanak', address: '서울 관악구 신림로 296', memo: null },
  { name: '제주아홉 이태원점', slug: '9jeju-itaewon', instagram_id: '9_jeju30', region: 'yongsan', address: '서울 용산구 이태원로19길 19', memo: null },
  { name: '제주아홉 강남점', slug: '9jeju-gangnam', instagram_id: '9_jeju33', region: 'gangnam', address: '서울 강남구 논현동 167-29', memo: null },
  { name: '제주아홉 구로디지털단지점', slug: '9jeju-gurodigital', instagram_id: '9_jeju15', region: 'gwanak', address: '서울 관악구 조원로8길 10', memo: 'xlsx 관악점과 동일' },
  { name: '제주아홉 을지로점', slug: '9jeju-euljiro', instagram_id: '9_jeju10', region: 'jongno', address: '서울 중구 마른내로2길 15-12', memo: null },
  { name: '제주아홉 잠실점', slug: '9jeju-jamsil', instagram_id: '9_jeju20', region: 'songpa', address: '서울 송파구 송파동 29-12 지하2층', memo: null },
  { name: '제주아홉 천호점', slug: '9jeju-cheonho', instagram_id: null, region: 'songpa', address: '서울 강동구 천호동 550-9', memo: 'IG 핸들 미매핑' },
  { name: '제주아홉 마곡나루점', slug: '9jeju-magongnaru', instagram_id: '9_jeju12', region: 'yeongdeungpo', address: '서울 강서구 강서로 409', memo: null },
  { name: '제주아홉 연신내점', slug: '9jeju-yeonsinnae', instagram_id: '9_jeju22', region: 'hongdae', address: '서울 은평구 갈현동 399-25', memo: null },
  { name: '제주아홉 사당점', slug: '9jeju-sadang', instagram_id: '9_jeju24', region: 'gwanak', address: '서울 동작구 사당동 708-446', memo: null },
  { name: '제주아홉 문래점', slug: '9jeju-mullae', instagram_id: '9_jeju25', region: 'yeongdeungpo', address: '서울 영등포구 문래동3가 58-8', memo: null },
  { name: '제주아홉 성신여대점', slug: '9jeju-sungshin', instagram_id: '9_jeju27', region: 'jongno', address: '서울 성북구 동소문로20다길 30-7', memo: null },
  { name: '제주아홉 노원점', slug: '9jeju-nowon', instagram_id: '9_jeju37', region: 'jongno', address: '서울 노원구 노해로85길 15-5', memo: null },
  { name: '제주아홉 신촌점', slug: '9jeju-sinchon', instagram_id: null, region: 'hongdae', address: '서울 서대문구 연세로5가길 17', memo: 'IG 핸들 미매핑' },

  // ── 야화 (10개 서울 지점) ──────────────────────────────────
  { name: '야화 논현점', slug: 'yahwa-nonhyeon', instagram_id: 'yahwa.bar_official', region: 'gangnam', address: '서울 강남구 강남대로122길 30 지하1층 01호', memo: 'MZ 감성 / 시그니처: 도화, 꽃잠 / 직영 본점' },
  { name: '야화 신림점', slug: 'yahwa-sillim', instagram_id: 'yahwa.bar_sillim', region: 'gwanak', address: '서울 관악구 신림동 1640-33', memo: '가맹' },
  { name: '야화 서울대입구역점', slug: 'yahwa-seouldae', instagram_id: 'yahwa.bar_seoul', region: 'gwanak', address: '서울 관악구 사당동 1041-1 3층', memo: '직영' },
  { name: '야화 사당이수점', slug: 'yahwa-sadang-isu', instagram_id: 'yahwa.bar__sadang', region: 'gwanak', address: '서울 동작구 사당동 144-11 수인빌딩 지하 1층', memo: '직영' },
  { name: '야화 을지로점', slug: 'yahwa-euljiro', instagram_id: 'yahwa.bar_euljiro', region: 'jongno', address: '서울 중구 을지로', memo: '직영' },
  { name: '야화 건대점', slug: 'yahwa-kondae', instagram_id: 'yahwa.bar_kondae', region: 'seongsu', address: '서울 광진구 능동로', memo: '직영' },
  { name: '야화 이태원점', slug: 'yahwa-itaewon', instagram_id: 'yahwa.bar_itaewon', region: 'yongsan', address: '서울 용산구 이태원로', memo: '가맹' },
  { name: '야화 강남점', slug: 'yahwa-gangnam', instagram_id: 'yahwa.bar_gangnamstation', region: 'gangnam', address: '서울 강남구', memo: '가맹' },
  { name: '야화 잠실점', slug: 'yahwa-jamsil', instagram_id: 'yahwa.bar_jamsilsaenae', region: 'songpa', address: '서울 송파구 잠실', memo: '가맹' },
  { name: '야화 구로점', slug: 'yahwa-guro', instagram_id: 'yahwa.bar_gurodigital', region: 'yeongdeungpo', address: '서울 구로구', memo: '가맹' },

  // ── 블렌딩바 (2) ──────────────────────────────────────────
  { name: '블렌딩바 망원점', slug: 'blendingbar-mangwon', instagram_id: 'blending_bar', region: 'hongdae', address: '서울 마포구 동교로 53-1 102호', memo: '관계를 블렌딩하는 커뮤니티바 / 전국 9개 직영 본점' },
  { name: '블렌딩바 연남점', slug: 'blendingbar-yeonnam', instagram_id: 'blending_bar_yeonnam', region: 'hongdae', address: '서울 마포구 연남동', memo: '블렌딩 분점' },

  // ── 유사길 (2) ────────────────────────────────────────────
  { name: '유사길 강남 본점', slug: 'yusagil-gangnam-main', instagram_id: 'yusagil_bar', region: 'gangnam', address: '서울 강남구', memo: '다같이 노는 #혼술바 / 12월 연말파티' },
  { name: '유사길 강남', slug: 'yusagil-gangnam-2', instagram_id: 'yusagil_gangnam', region: 'gangnam', address: '서울 강남구', memo: '본점과 별개 계정' },

  // ── 고도 (서울 2) ─────────────────────────────────────────
  { name: '고도 연남점', slug: 'godo-yeonnam', instagram_id: 'godo_yeonnam', region: 'hongdae', address: '서울 마포구 연남동', memo: '제주 본점 + 서울 지점' },
  { name: '고도 잠실점', slug: 'godo-jamsil', instagram_id: 'godo_jamsil', region: 'songpa', address: '서울 송파구', memo: '서울 지점' },
  { name: '고도 이태원점', slug: 'godo-itaewon', instagram_id: null, region: 'yongsan', address: '서울 용산구 이태원/해방촌', memo: 'IG 핸들 미매핑 (해방촌 지점)' },

  // ── 독립 (xlsx ✓ 검증, IG 확인) ─────────────────────────
  { name: '벋마루', slug: 'friendsmaru', instagram_id: 'friendsmaru', region: 'gwanak', address: '서울 관악구 봉천동 871-67 3층', memo: '친구집같이 편안한 아지트 / 16:00-02:00, 월요일 휴무' },
  { name: '깃털', slug: 'gitteol', instagram_id: 'gitteol_hongyang', region: 'hongdae', address: '서울 마포구 연남동', memo: '혼술 환영 / 18:00-05:00 매일오픈' },
  { name: '혼술바 자작', slug: 'zazak-bar', instagram_id: 'zazak_bar', region: 'gwanak', address: '서울 (위치 미확인)', memo: '옆자리 손님과 편하게 얘기 / 친해질 분들 환영 — 위치 admin에서 보완 필요' },
  { name: 'SOCIAL CLUB', slug: 'social-club', instagram_id: 'social.club___', region: 'jongno', address: '서울 종로구 돈화문로 45', memo: '월/수/목/금 20:00- / 토/일 19:00- / 화 휴무' },
  { name: 'wee.kendbar (영등포 주말혼술바)', slug: 'weekendbar', instagram_id: 'wee.kendbar', region: 'yeongdeungpo', address: '서울 영등포구 문래로 183', memo: '주말혼술바 / 화요일 영업 시작' },
  { name: '카로우셀바', slug: 'bar-carousel', instagram_id: 'bar.carousel', region: 'hongdae', address: '서울 마포구 와우산로 162', memo: '위스키+칵테일 / 20:00-05:00 (경의선숲길 책거리)' },
  { name: 'bar_woowoo', slug: 'bar-woowoo', instagram_id: 'bar_woowoo', region: 'hongdae', address: '서울 마포구 상수동', memo: '홍대혼술/합정혼술/칵테일바' },
  { name: '어울림 혼술바 선릉', slug: 'oullim-seolleung', instagram_id: 'oullim_seolleung', region: 'gangnam', address: '서울 강남구 선릉', memo: '2030 느슨한 연대 / 브런치 매거진 운영' },
  { name: '장생건강원', slug: 'bar-jangsaeng', instagram_id: 'bar_jangsaeng', region: 'gangnam', address: '서울 강남구 영동시장 안', memo: '칵테일을 처방해드립니다' },
  { name: '주연', slug: 'juyeon-bar', instagram_id: 'juyeon.bar', region: 'seongsu', address: '서울 광진구 구의동', memo: '구의 혼술바' },
  { name: '구 서울', slug: 'gu-seoul', instagram_id: 'gu.seoul', region: 'jongno', address: '서울 중구 마장로 82 2층', memo: '커플/소개팅 다수 / 2-4인 테이블 (2024.11 오픈)' },
  { name: '혼술아틀란티스', slug: 'honsul-atlantis', instagram_id: 'honsul_atlantis', region: 'hongdae', address: '서울 마포구 와우산로29길 4-36 지층', memo: '처음 본 옆 사람과 대화 / 영국 동네 펍' },
  { name: '탭샵바', slug: 'tap-shop-bar', instagram_id: 'tap.shop.bar', region: 'hongdae', address: '서울 마포구 합정 (합정역 2번 출구 도보 1분)', memo: '와인바 / 혼술 친화 / 다이닝코드 ★4.5' },
  { name: '사우스사이드 팔러', slug: 'southside-parlor', instagram_id: 'southsideparlor', region: 'yongsan', address: '서울 용산구 이태원/경리단길', memo: '미국 남부 텍사스 컨셉 / 외국인 多 / 자유로운 분위기' },
  { name: '만평 바이닐 뮤직', slug: 'manpyong', instagram_id: 'manpyong', region: 'hongdae', address: '서울 마포구 합정', memo: 'LP 바이닐 뮤직 / 좋아하는 이성과 가기 좋음' },

  // ── 독립 (xlsx ? — IG 미매핑, 일단 인서트) ─────────────
  { name: '딘 (Dean 1998)', slug: 'dean-1998', instagram_id: null, region: 'gangnam', address: '서울 강남구 강남역 일대', memo: '컨셉 정확히 매치 / 다트바 / 한잔 만원대 — IG 미매핑' },
  { name: '거북이조합', slug: 'turtle-coop', instagram_id: null, region: 'hongdae', address: '서울 마포구 연남동', memo: '아가미+유덕화+민들레 조합 / 와글와글 — IG 미매핑' },
  { name: '심심', slug: 'simsim-noryangjin', instagram_id: null, region: 'gwanak', address: '서울 동작구 만양로14길 37', memo: '2026.01 노량진 오픈 신상 — IG 미매핑' },
  { name: '동꾼', slug: 'dongkkun', instagram_id: null, region: 'hongdae', address: '서울 마포구 홍대', memo: '홍대 혼술 명소 — IG 미매핑' },
  { name: '뱃장', slug: 'baetjang', instagram_id: null, region: 'hongdae', address: '서울 마포구 연남동 (연트럴파크)', memo: '1인 화로 + 칸막이 / 한우 위주 — IG 미매핑' },

  // ── 디스커버리 신규 (3) ──────────────────────────────────
  { name: '혼술바제비', slug: 'bar-jebi', instagram_id: 'bar_jebi', region: 'seongsu', address: '서울 광진구 건대/성수', memo: '건대혼술바 / 성수혼술바' },
  { name: '문래한잔', slug: 'mullae-hanjan', instagram_id: 'mullae_hanjan', region: 'yeongdeungpo', address: '서울 영등포구 문래동2가', memo: '서울 혼술바' },
  { name: '도란 홍대점', slug: 'doran-hongdae', instagram_id: 'doran_hongdae', region: 'hongdae', address: '서울 마포구 홍대/합정/상수', memo: '홍대혼술바 / 합정혼술바' },
];

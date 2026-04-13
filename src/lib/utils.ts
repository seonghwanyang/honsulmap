/**
 * 상대시간 표시
 * "방금" (1분 미만), "N분 전" (60분 미만), "N시간 전" (24시간 미만),
 * "N일 전" (7일 미만), "2026.04.13" (7일 이상)
 */
export function relativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;

  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 브라우저 핑거프린트 생성 (간단 버전)
 */
export function getFingerprint(): string {
  if (typeof window === 'undefined') return '';

  const stored = localStorage.getItem('honsul_fp');
  if (stored) return stored;

  const fp = crypto.randomUUID();
  localStorage.setItem('honsul_fp', fp);
  return fp;
}

/**
 * slug 생성 (한글 → 영문 변환 없이, 공백→하이픈)
 */
export function createSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w가-힣-]/g, '')
    .replace(/-+/g, '-');
}

/**
 * 카테고리 한글 라벨
 */
export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    status: '현황',
    review: '후기',
    tip: '꿀팁',
    free: '자유',
    bar: '바',
    guesthouse: '게스트하우스',
    pub: '펍',
    wine_bar: '와인바',
    karaoke_bar: '노래바',
  };
  return labels[category] || category;
}

/**
 * 지역 한글 라벨
 */
export function getRegionLabel(region: string): string {
  const labels: Record<string, string> = {
    jeju: '제주시',
    aewol: '애월',
    seogwipo: '서귀포',
    east: '동쪽',
    west: '서쪽',
  };
  return labels[region] || region;
}

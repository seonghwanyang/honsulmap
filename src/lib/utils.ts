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

  const fp = randomUuid();
  localStorage.setItem('honsul_fp', fp);
  return fp;
}

// crypto.randomUUID() is secure-context-only — undefined on http:// LAN
// IPs and older iOS Safari, which throws "randomUUID is not a function".
// Fall back to getRandomValues (works in insecure contexts) and finally
// Math.random. A fingerprint only needs to be stable + unique-ish, not
// cryptographically strong.
function randomUuid(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  if (c?.getRandomValues) {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0'));
    return `${h[0]}${h[1]}${h[2]}${h[3]}-${h[4]}${h[5]}-${h[6]}${h[7]}-${h[8]}${h[9]}-${h[10]}${h[11]}${h[12]}${h[13]}${h[14]}${h[15]}`;
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}-${Math.random().toString(16).slice(2, 10)}`;
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
 * Post title → URL slug. Strips emoji/punctuation, collapses whitespace
 * to hyphens, caps at 60 chars. Returns a non-empty string for any input
 * that contains at least one Hangul/word char; otherwise returns 'post'
 * so the caller can rely on a usable seed for the dedup step.
 */
export function generatePostSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^\w가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return base || 'post';
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
  };
  return labels[category] || category;
}

/**
 * 지역 한글 라벨
 */
import { REGIONS } from './types';

// Cache: { gangnam → '강남구', mapo → '마포구', ... } — built once from
// the single source of truth in types.ts so adding a new city's regions
// only requires editing REGIONS, not patching this map.
const REGION_LABELS: Record<string, string> = REGIONS.reduce(
  (acc, r) => {
    acc[r.value] = r.label;
    return acc;
  },
  {} as Record<string, string>,
);

export function getRegionLabel(region: string): string {
  return REGION_LABELS[region] || region;
}

// 토스플레이스 Open API 서버 헬퍼 — 파트너 라우트 전용 (키는 서버 env에만).
// 실패는 전부 null로 흡수한다: 토스 장애가 우리 보드/설정을 죽이면 안 됨.

const BASE = 'https://open-api.tossplace.com/api-public/openapi/v1';

export async function tossFetch<T = unknown>(path: string, timeoutMs = 4000): Promise<T | null> {
  const ak = process.env.TOSSPLACE_ACCESS_KEY;
  const sk = process.env.TOSSPLACE_SECRET_KEY;
  if (!ak || !sk) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'x-access-key': ak, 'x-secret-key': sk },
      signal: ctrl.signal,
      cache: 'no-store',
    });
    const d = (await res.json().catch(() => null)) as { resultType?: string; success?: T } | null;
    if (!res.ok || d?.resultType !== 'SUCCESS') return null;
    return d.success ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// 쓰기 호출 — 주문 주입 등. 실패는 상태코드와 함께 돌려주되 던지지 않는다.
export async function tossPost(
  path: string,
  body: unknown,
  timeoutMs = 5000,
): Promise<{ status: number; data: unknown } | null> {
  const ak = process.env.TOSSPLACE_ACCESS_KEY;
  const sk = process.env.TOSSPLACE_SECRET_KEY;
  if (!ak || !sk) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'x-access-key': ak, 'x-secret-key': sk, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return { status: res.status, data: await res.json().catch(() => null) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// 페이지네이션 전량 수집 — 토스 목록 API는 page/size(기본 100)라 100개 초과분이 잘린다.
// 짧은 페이지가 나올 때까지 순회 (안전 상한 10페이지 = 1000개).
export async function tossFetchAll<T = unknown>(path: string, size = 100): Promise<T[] | null> {
  const all: T[] = [];
  for (let page = 1; page <= 10; page++) {
    const sep = path.includes('?') ? '&' : '?';
    const batch = await tossFetch<T[]>(`${path}${sep}page=${page}&size=${size}`, 6000);
    if (batch === null) return page === 1 ? null : all; // 첫 페이지 실패만 실패로
    all.push(...batch);
    if (batch.length < size) break;
  }
  return all;
}

// config.modes jsonb에서 토스 매장번호 꺼내기 (컬럼 대신 modes에 보관 — 마이그레이션 불필요)
export function tossMerchantId(modes: unknown): string | null {
  const m = modes as { toss_merchant_id?: unknown } | null;
  return typeof m?.toss_merchant_id === 'string' && m.toss_merchant_id ? m.toss_merchant_id : null;
}

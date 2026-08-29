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

// config.modes jsonb에서 토스 매장번호 꺼내기 (컬럼 대신 modes에 보관 — 마이그레이션 불필요)
export function tossMerchantId(modes: unknown): string | null {
  const m = modes as { toss_merchant_id?: unknown } | null;
  return typeof m?.toss_merchant_id === 'string' && m.toss_merchant_id ? m.toss_merchant_id : null;
}

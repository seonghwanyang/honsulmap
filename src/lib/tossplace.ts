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

// 포스 전송 경로 — 'openapi'(기본): 서버가 Open API로 주입(현황 탭행)
//                 'plugin': 포스 플러그인이 피드를 끌어가 테이블에 직접 생성
export function tossPushMode(modes: unknown): 'openapi' | 'plugin' {
  const m = modes as { toss_push?: unknown } | null;
  return m?.toss_push === 'plugin' ? 'plugin' : 'openapi';
}

// Open API 주문 생성 페이로드 — orders 라우트와 플러그인 폴백(ack 라우트)이 공유.
// 주의: 빈 memo는 토스가 400으로 거부 — 있을 때만 필드 포함.
export function buildOpenApiOrderPayload(args: {
  orderKey: string;
  seatLabel: string;
  items: { name: string; price: number; qty: number; request?: string | null }[];
}) {
  const total = args.items.reduce((acc, it) => acc + it.price * it.qty, 0);
  const taxAmount = Math.round((total * 10) / 110);
  return {
    order: {
      orderKey: args.orderKey,
      orderNumber: `좌석${args.seatLabel}`,
      lineItems: args.items.map((it) => {
        const req = (it.request ?? '').trim().slice(0, 100);
        return {
          diningOption: 'HERE',
          targetType: 'AD_HOC',
          item: { title: it.name.slice(0, 60), category: { title: '혼술맵 QR' } },
          itemPrice: { title: '기본', priceType: 'FIXED', priceUnit: 1, priceValue: it.price, isTaxFree: false, taxInclusive: true },
          quantity: it.qty,
          ...(req ? { memo: req } : {}),
        };
      }),
      chargePrice: {
        listPrice: total,
        discountAmount: 0,
        tipAmount: 0,
        serviceChargeAmount: 0,
        taxAmount,
        supplyAmount: total - taxAmount,
        taxExemptAmount: 0,
        totalAmount: total,
      },
      memo: `혼술맵 QR 주문 · 좌석 ${args.seatLabel}`,
      openedAt: new Date().toISOString(),
    },
    payments: [],
  };
}

// 플러그인 모드 안전망 — 포스 꺼짐/플러그인 사망으로 90초 넘게 미처리된 주문을
// Open API로 폴백 주입. 주문 보드 폴링(영업 중 상시)에서 fire-and-forget으로 호출.
// ack 레코드를 먼저 남겨 동시 폴링의 이중 폴백을 막는다.
export async function sweepUnackedPluginOrders(
  admin: ReturnType<typeof import('@/lib/supabase').supabaseAdmin>,
  spotId: string,
  mid: string,
): Promise<void> {
  try {
    const since = new Date(Date.now() - 30 * 60000).toISOString();
    const cutoff = new Date(Date.now() - 90_000).toISOString();
    const { data: orders } = await admin
      .from('table_orders')
      .select('id, seat_label, items:table_order_items(item_name, price, qty, request)')
      .eq('spot_id', spotId)
      .gte('created_at', since)
      .lte('created_at', cutoff)
      .in('status', ['new', 'accepted'])
      .gt('total', 0);
    if (!orders?.length) return;
    const { data: acks } = await admin
      .from('tossplace_events')
      .select('payload')
      .eq('event_type', 'plugin.push.ack')
      .gte('created_at', since);
    const acked = new Set(
      (acks ?? []).map((a) => (a.payload as { order_id?: string })?.order_id).filter(Boolean),
    );
    for (const o of orders) {
      if (acked.has(o.id)) continue;
      const items = o.items
        .filter((it) => it.price > 0)
        .map((it) => ({ name: it.item_name, price: it.price, qty: it.qty, request: it.request }));
      if (!items.length) continue;
      await admin.from('tossplace_events').insert({
        event_type: 'plugin.push.ack',
        payload: { order_id: o.id, outcome: 'timeout-fallback', mid },
        headers: {},
      });
      await pushOrderToPos(mid, buildOpenApiOrderPayload({ orderKey: `${o.id}-fb`, seatLabel: o.seat_label, items }));
      console.warn('[tossplugin] 플러그인 미응답 → Open API 폴백:', o.id);
    }
  } catch (e) {
    console.warn('[tossplugin] sweep 실패:', (e as Error).message);
  }
}

// 재시도 포함 주입 — 일시 오류(타임아웃/5xx) 1회 재시도. 403(권한 전)은 조용히.
export async function pushOrderToPos(
  mid: string,
  payload: ReturnType<typeof buildOpenApiOrderPayload>,
): Promise<void> {
  const path = `/merchants/${mid}/order/orders?printOrderSheet=true`;
  let res = await tossPost(path, payload, 8000);
  if (!res || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1200));
    res = await tossPost(path, payload, 8000);
  }
  if (!res) {
    console.warn('[tossplace] order push no-response (timeout/network):', payload.order.orderKey);
  } else if (res.status !== 200 && res.status !== 201 && res.status !== 403) {
    console.warn('[tossplace] order push failed:', res.status, JSON.stringify(res.data).slice(0, 200));
  }
}

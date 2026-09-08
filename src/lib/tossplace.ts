// 토스플레이스 Open API 서버 헬퍼 — 파트너 라우트 전용 (키는 서버 env에만).
// 실패는 전부 null로 흡수한다: 토스 장애가 우리 보드/설정을 죽이면 안 됨.

import { businessDayStart } from '@/lib/tableDay';

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

// 피드가 주문 id를 "Q007_<uuid>" 형태로 내린다 (토스가 orderKey의 '_' 앞부분을
// 포스 주문번호로 표시하는 것을 이용 — UUID가 그대로 주문번호로 찍히는 문제 해결).
// ack·웹훅·스윕 어디서든 이 함수로 원 UUID를 복원한다. 접미사(-fb/-retry/-mv)도 제거
// — -mv는 자리이동 재생성분, 연쇄 이동으로 겹칠 수 있어 반복 제거.
export function extractOrderUuid(key: string): string {
  return (key.split('_').pop() ?? key).replace(/(-(fb|retry|mv))+$/, '');
}

// 지난 영업분 포스 잔재 청소 — 우리가 Open API로 만든 현황행(주문번호 "좌석N")이
// 열린 채 남으면 다음 영업일에 합류 오폭·현황 혼란의 화약고가 된다 (실측: 9/9 새벽
// 좌석11 사고 조사에서 9/7 잔재 7건 발견). 취소 권한이 있는 건 이 부류뿐이라(채널
// 제한 — 플러그인·포스 생성분은 403) 매일 마감 크론에서 이것만 자동 정리한다.
export async function cancelStaleApiOrders(mid: string, beforeIso: string): Promise<number> {
  try {
    const from = new Date(Date.parse(beforeIso) - 48 * 3600_000).toISOString();
    const to = new Date().toISOString();
    const list = await tossFetch<{ id?: unknown; orderNumber?: unknown; openedAt?: string; createdAt?: string }[]>(
      `/merchants/${mid}/order/orders?orderStates=OPENED&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=1&size=100`,
      8000,
    );
    if (!Array.isArray(list)) return 0;
    let n = 0;
    for (const o of list) {
      if (!o?.id || !/^좌석/.test(String(o.orderNumber ?? ''))) continue; // 우리 API 생성분만
      const at = String(o.openedAt ?? o.createdAt ?? '');
      if (!at || at >= beforeIso) continue; // 이번 영업분은 보존
      const res = await tossPost(`/merchants/${mid}/order/orders/${o.id}/cancel`, { cancelReason: '영업일 마감 자동 정리' });
      if (res?.status === 200) n++;
    }
    return n;
  } catch {
    return 0;
  }
}

// ── 역방향 싱크 (포스 → 혼술맵, v5.2) ──
// 플러그인이 보고한 포스 직접 주문(직원 입력, 우리 orderKey가 아닌 것)을 좌석의 활성
// 세션에 붙이거나, 세션이 없으면 보류 이벤트로 남겼다가 그 좌석 체크인 때 귀속한다.
// 생성 즉시 pos-import ack(행 uuid ↔ 포스 주문 id)를 남긴다 — ① 피드/스윕이 이 행을
// 다시 포스로 밀지 않게(루프 방지) ② 결제/취소 웹훅이 기존 형제 완결 로직으로 닫게.
export type PosOrderReport = {
  id: string;
  order_key?: string;
  seat_label: string; // 포스 테이블명 숫자 ("01" 형태 가능 — 우리 라벨로 정규화해 사용)
  total: number;
  state?: string;
  lines: { name: string; qty: number; price: number }[]; // price = 라인 합계
};

type AdminClient = ReturnType<typeof import('@/lib/supabase').supabaseAdmin>;

const OUR_ORDER_KEY_RE = /^(Q\d+_|hsm-demo-)|-(fb|retry|mv)$/;
const normSeat = (s: unknown) => {
  const d = String(s ?? '').replace(/\D/g, '');
  return d ? String(Number(d)) : '';
};

function posLineRows(orderId: string, po: PosOrderReport) {
  return po.lines
    .filter((l) => l && l.name)
    .slice(0, 50)
    .map((l) => ({
      order_id: orderId,
      item_name: `[포스] ${String(l.name).slice(0, 56)}`,
      price: Math.max(0, Math.round((Number(l.price) || 0) / Math.max(1, Number(l.qty) || 1))),
      qty: Math.max(1, Number(l.qty) || 1),
    }));
}

async function materializePosOrder(
  admin: AdminClient,
  spotId: string,
  mid: string,
  sessionId: string,
  seatLabel: string,
  po: PosOrderReport,
): Promise<void> {
  const { data: row } = await admin
    .from('table_orders')
    .insert({ spot_id: spotId, session_id: sessionId, seat_label: seatLabel, total: Math.max(0, Number(po.total) || 0), status: 'accepted' })
    .select('id')
    .single();
  if (!row) return;
  const items = posLineRows(row.id, po);
  if (items.length) await admin.from('table_order_items').insert(items);
  await admin.from('tossplace_events').insert({
    event_type: 'plugin.push.ack',
    payload: { order_id: row.id, outcome: 'pos-import', toss_order_id: String(po.id), mid },
    headers: {},
  });
}

// 플러그인 보고 수신 — 이미 귀속된 주문이면 스냅샷 갱신(직원이 품목 추가한 경우),
// 활성 세션 있으면 즉시 귀속, 없으면 보류(체크인 때 claim).
export async function ingestPosOrderReports(
  admin: AdminClient,
  spotId: string,
  mid: string,
  reports: PosOrderReport[],
): Promise<void> {
  for (const po of (reports ?? []).slice(0, 30)) {
    try {
      const posId = String(po?.id ?? '');
      const seatLabel = normSeat(po?.seat_label);
      if (!posId || !seatLabel || !Array.isArray(po?.lines)) continue;
      if (OUR_ORDER_KEY_RE.test(String(po.order_key ?? ''))) continue; // 우리 주문은 대상 아님
      const { data: maps } = await admin
        .from('tossplace_events')
        .select('payload')
        .eq('event_type', 'plugin.push.ack')
        .eq('payload->>outcome', 'pos-import')
        .eq('payload->>toss_order_id', posId)
        .limit(1);
      const rowId = (maps?.[0]?.payload as { order_id?: string } | undefined)?.order_id;
      if (rowId) {
        const { data: row } = await admin.from('table_orders').select('id, status').eq('id', rowId).maybeSingle();
        if (!row || !['new', 'accepted'].includes(row.status)) continue; // 닫힌 주문 불변
        await admin.from('table_orders').update({ total: Math.max(0, Number(po.total) || 0) }).eq('id', rowId);
        await admin.from('table_order_items').delete().eq('order_id', rowId);
        const items = posLineRows(rowId, po);
        if (items.length) await admin.from('table_order_items').insert(items);
        continue;
      }
      const { data: seat } = await admin
        .from('store_seats')
        .select('id')
        .eq('spot_id', spotId)
        .eq('label', seatLabel)
        .maybeSingle();
      const { data: sess } = seat
        ? await admin
            .from('table_sessions')
            .select('id')
            .eq('spot_id', spotId)
            .eq('seat_id', seat.id)
            .eq('active', true)
            .maybeSingle()
        : { data: null };
      if (sess?.id) await materializePosOrder(admin, spotId, mid, sess.id, seatLabel, po);
      else
        await admin.from('tossplace_events').insert({
          event_type: 'pos.order.pending',
          payload: { mid, spot_id: spotId, seat_label: seatLabel, pos_order: po },
          headers: {},
        });
    } catch (e) {
      console.warn('[pos-import] ingest 실패:', (e as Error).message);
    }
  }
}

// 체크인/자리이동 때 호출 — 그 좌석에 보류 중인 포스 주문(영업일 내, 아직 열린 것)을
// 이 세션으로 귀속한다. "포스로 먼저 찍고 나중에 체크인" 케이스의 승계 지점.
export async function claimPendingPosOrders(
  admin: AdminClient,
  spotId: string,
  seatLabel: string,
  sessionId: string,
): Promise<number> {
  try {
    const { data: evs } = await admin
      .from('tossplace_events')
      .select('payload, created_at')
      .eq('event_type', 'pos.order.pending')
      .eq('payload->>spot_id', spotId)
      .eq('payload->>seat_label', seatLabel)
      .gte('created_at', businessDayStart())
      .order('created_at', { ascending: true });
    if (!evs?.length) return 0;
    const latest = new Map<string, { po: PosOrderReport; mid: string }>();
    for (const e of evs) {
      const p = e.payload as { mid?: string; pos_order?: PosOrderReport };
      if (p?.pos_order?.id) latest.set(String(p.pos_order.id), { po: p.pos_order, mid: String(p.mid ?? '') });
    }
    let claimed = 0;
    for (const [posId, { po, mid }] of latest) {
      if (po.state && po.state !== 'OPENED') continue;
      // 이미 귀속됐거나 우리가 만든 주문(added/moved ack)이면 스킵
      const { data: prior } = await admin
        .from('tossplace_events')
        .select('id')
        .eq('event_type', 'plugin.push.ack')
        .eq('payload->>toss_order_id', posId)
        .limit(1);
      if (prior?.length) continue;
      // 보류 이후 이미 결제/취소로 닫힌 주문이면 승계하지 않는다
      const { data: closed } = await admin
        .from('tossplace_events')
        .select('id')
        .in('event_type', ['order.order.completed.v1', 'order.order.cancelled.v1'])
        .eq('payload->data->>orderId', posId)
        .limit(1);
      if (closed?.length) continue;
      await materializePosOrder(admin, spotId, mid, sessionId, seatLabel, po);
      claimed++;
    }
    return claimed;
  } catch (e) {
    console.warn('[pos-import] claim 실패:', (e as Error).message);
    return 0;
  }
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
      (acks ?? [])
        .map((a) => (a.payload as { order_id?: string })?.order_id)
        .filter((v): v is string => Boolean(v))
        .map(extractOrderUuid), // 구형(uuid)·신형(Q007_uuid) ack 모두 원 UUID로 비교
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

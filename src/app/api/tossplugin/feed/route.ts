import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { buildOpenApiOrderPayload, extractOrderUuid, pushOrderToPos } from '@/lib/tossplace';
import { businessDayStart } from '@/lib/tableDay';

// 포스 플러그인 전용 피드 — 플러그인이 5초마다 끌어가 테이블에 주문을 직접 생성한다.
//   GET  ?mid={토스 매장번호}: 미전송 QR 주문 목록 (toss_push='plugin' 가게만)
//   POST ack {mid, order_id, outcome, toss_order_id?}: 처리 결과 기록.
//        outcome이 'added'가 아니면(카탈로그 매칭 실패 등) Open API로 폴백 주입해
//        어떤 경우에도 주문이 포스에 한 번은 도달하게 한다.
// ack 저장은 tossplace_events 재사용(event_type='plugin.push.ack') — 마이그레이션 불필요.

const WINDOW_MIN = 30;

function authed(request: NextRequest): boolean {
  const key = process.env.TOSSPLUGIN_FEED_KEY;
  if (!key) return false; // env 미설정 시 잠금
  return request.headers.get('x-hsm-plugin-key') === key;
}

async function spotForMerchant(mid: string) {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from('store_table_config')
    .select('spot_id, modes')
    .eq('modes->>toss_merchant_id', mid)
    .eq('modes->>toss_push', 'plugin')
    .maybeSingle();
  return data ? { admin, spotId: data.spot_id as string } : null;
}

// 플러그인 생존 하트비트 — 폴링이 올 때마다 modes.plugin_last_seen 갱신 (60초 스로틀).
// 포스에서 플러그인이 실제로 돌고 있는지 원격 확인용 (토스 권고 "자체 로그"의 1단계).
async function stampLiveness(mid: string) {
  try {
    const admin = supabaseAdmin();
    const { data } = await admin
      .from('store_table_config')
      .select('spot_id, modes')
      .eq('modes->>toss_merchant_id', mid)
      .maybeSingle();
    if (!data) return;
    const modes = (data.modes ?? {}) as Record<string, unknown>;
    const last = typeof modes.plugin_last_seen === 'string' ? Date.parse(modes.plugin_last_seen) : 0;
    if (Date.now() - last < 60_000) return;
    await admin
      .from('store_table_config')
      .update({ modes: { ...modes, plugin_last_seen: new Date().toISOString() } })
      .eq('spot_id', data.spot_id);
  } catch {
    /* 하트비트 실패는 무시 */
  }
}

export async function GET(request: NextRequest) {
  if (!authed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const mid = request.nextUrl.searchParams.get('mid') ?? '';
  if (!/^\d{1,20}$/.test(mid)) return NextResponse.json({ error: 'bad mid' }, { status: 400 });

  await stampLiveness(mid);
  const ctx = await spotForMerchant(mid);
  // 미연동 매장(검수 환경 포함) — demo 플래그를 내려 플러그인이 자기 포스의
  // 카탈로그·테이블로 검수용 데모 주문을 1회 생성하게 한다 (동작 시연용).
  if (!ctx) return NextResponse.json({ orders: [], demo: true });

  const since = new Date(Date.now() - WINDOW_MIN * 60000).toISOString();
  const [{ data: orders }, { data: acks }, { data: dayOrders }] = await Promise.all([
    ctx.admin
      .from('table_orders')
      .select('id, seat_label, total, created_at, status, items:table_order_items(item_name, price, qty, request)')
      .eq('spot_id', ctx.spotId)
      .gte('created_at', since)
      .in('status', ['new', 'accepted'])
      .gt('total', 0)
      .order('created_at', { ascending: true }),
    ctx.admin
      .from('tossplace_events')
      .select('payload')
      .eq('event_type', 'plugin.push.ack')
      .gte('created_at', new Date(Date.now() - 2 * WINDOW_MIN * 60000).toISOString()),
    // 오늘 영업분 순번 — 포스 주문번호 표기용 (Q001, Q002 …)
    ctx.admin
      .from('table_orders')
      .select('id')
      .eq('spot_id', ctx.spotId)
      .gte('created_at', businessDayStart())
      .gt('total', 0)
      .order('created_at', { ascending: true }),
  ]);

  const acked = new Set(
    (acks ?? [])
      .map((a) => (a.payload as { order_id?: string })?.order_id)
      .filter((v): v is string => Boolean(v))
      .map(extractOrderUuid),
  );
  const seqOf = new Map((dayOrders ?? []).map((o, i) => [o.id, i + 1]));
  const pending = (orders ?? [])
    .filter((o) => !acked.has(o.id))
    .map((o) => ({
      // "Q순번_uuid" — 플러그인이 이 값을 orderKey로 그대로 쓰면 토스가 '_' 앞부분을
      // 주문번호로 표시한다 (v2 플러그인 무수정 적용). 서버 쪽은 extractOrderUuid로 복원.
      id: `Q${String(seqOf.get(o.id) ?? 0).padStart(3, '0')}_${o.id}`,
      seat_label: o.seat_label,
      created_at: o.created_at,
      total: o.total,
      items: o.items.map((it) => ({ name: it.item_name, price: it.price, qty: it.qty, request: it.request })),
    }));

  return NextResponse.json({ orders: pending });
}

export async function POST(request: NextRequest) {
  if (!authed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const mid = typeof body.mid === 'string' ? body.mid : '';

  // 플러그인 원격 로그 (토스 검수 권고 대응) — 미연동 매장(검수 환경) 로그도 받는다.
  if (body.log && typeof body.log === 'object') {
    const lg = body.log as { level?: unknown; msg?: unknown; detail?: unknown };
    await supabaseAdmin()
      .from('tossplace_events')
      .insert({
        event_type: 'plugin.log',
        payload: {
          mid,
          level: String(lg.level ?? 'error').slice(0, 10),
          msg: String(lg.msg ?? '').slice(0, 300),
          detail: String(lg.detail ?? '').slice(0, 500),
        },
        headers: {},
      })
      .then(({ error }) => {
        if (error) console.warn('[plugin.log] store failed:', error.message);
      });
    return NextResponse.json({ ok: true });
  }
  // 플러그인은 피드의 "Q순번_uuid" id를 그대로 돌려보낸다 — 원 UUID로 복원해 처리
  const orderId = typeof body.order_id === 'string' ? extractOrderUuid(body.order_id) : '';
  const outcome = ['added', 'unmatched', 'error'].includes(body.outcome) ? (body.outcome as string) : 'error';
  if (!/^\d{1,20}$/.test(mid) || !orderId) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const ctx = await spotForMerchant(mid);
  if (!ctx) return NextResponse.json({ error: 'not linked' }, { status: 404 });

  await ctx.admin.from('tossplace_events').insert({
    event_type: 'plugin.push.ack',
    payload: { order_id: orderId, outcome, toss_order_id: body.toss_order_id ?? null, mid },
    headers: {},
  });

  // 매칭 실패/에러 → Open API 폴백 (현황 탭행이지만 최소 한 번은 포스 도달 보장)
  if (outcome !== 'added') {
    const { data: order } = await ctx.admin
      .from('table_orders')
      .select('id, seat_label, items:table_order_items(item_name, price, qty, request)')
      .eq('id', orderId)
      .eq('spot_id', ctx.spotId)
      .maybeSingle();
    if (order) {
      const items = order.items
        .filter((it) => it.price > 0)
        .map((it) => ({ name: it.item_name, price: it.price, qty: it.qty, request: it.request }));
      if (items.length) {
        await pushOrderToPos(mid, buildOpenApiOrderPayload({ orderKey: `${order.id}-fb`, seatLabel: order.seat_label, items }));
      }
    }
  }

  return NextResponse.json({ ok: true });
}

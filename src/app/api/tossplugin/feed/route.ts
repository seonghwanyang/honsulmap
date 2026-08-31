import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { buildOpenApiOrderPayload, pushOrderToPos } from '@/lib/tossplace';

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

export async function GET(request: NextRequest) {
  if (!authed(request)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const mid = request.nextUrl.searchParams.get('mid') ?? '';
  if (!/^\d{1,20}$/.test(mid)) return NextResponse.json({ error: 'bad mid' }, { status: 400 });

  const ctx = await spotForMerchant(mid);
  if (!ctx) return NextResponse.json({ orders: [] }); // 미연동/모드 아님 — 플러그인은 조용히 대기

  const since = new Date(Date.now() - WINDOW_MIN * 60000).toISOString();
  const [{ data: orders }, { data: acks }] = await Promise.all([
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
  ]);

  const acked = new Set(
    (acks ?? []).map((a) => (a.payload as { order_id?: string })?.order_id).filter(Boolean),
  );
  const pending = (orders ?? [])
    .filter((o) => !acked.has(o.id))
    .map((o) => ({
      id: o.id,
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
  const orderId = typeof body.order_id === 'string' ? body.order_id : '';
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

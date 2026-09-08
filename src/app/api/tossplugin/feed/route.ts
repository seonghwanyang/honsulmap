import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { buildOpenApiOrderPayload, extractOrderUuid, ingestPosOrderReports, pushOrderToPos, type PosOrderReport } from '@/lib/tossplace';
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
  const [{ data: orders }, { data: acks }, { data: dayOrders }, { data: moveRows }] = await Promise.all([
    ctx.admin
      .from('table_orders')
      .select('id, seat_label, total, created_at, status, session:table_sessions(checked_in_at), items:table_order_items(item_name, price, qty, request)')
      .eq('spot_id', ctx.spotId)
      .gte('created_at', since)
      .in('status', ['new', 'accepted'])
      .gt('total', 0)
      .order('created_at', { ascending: true }),
    ctx.admin
      .from('tossplace_events')
      .select('payload, created_at')
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
    // 자리이동 마커(₩0 주문, 아이템 "자리 이동: A → B") — 플러그인 이동 지시의 원천
    ctx.admin
      .from('table_orders')
      .select('id, session_id, seat_label, items:table_order_items(item_name)')
      .eq('spot_id', ctx.spotId)
      .gte('created_at', since)
      .eq('total', 0)
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
      // 포스 테이블명이 "01"처럼 0패딩이면 플러그인의 문자열 매칭("1"≠"01")이 어긋나
      // 단자리 좌석이 테이블 미부착으로 들어감(실측: 좌석1·5·6 전표만, 21은 정상) — 패딩해 전달
      seat_label: /^\d$/.test(o.seat_label) ? `0${o.seat_label}` : o.seat_label,
      created_at: o.created_at,
      total: o.total,
      // 합류 커트라인 — 이 손님 "체크인 이후"에 열린 계산서에만 addMenu 허용 (시계 오차
      // 대비 2분만 완충). 30분 여유를 두면 직전 손님의 미결제 계산서(예: 1:00 개시)에
      // 1:10 체크인한 새 손님이 합류하는 충돌이 생김 — 유저 지적으로 조임.
      // 체크인 전 직원 선입력 케이스는 합류 대신 현황행 폴백으로 도달 (전표 보장).
      joinable_after: (() => {
        const s = o.session as { checked_in_at?: string } | { checked_in_at?: string }[] | null;
        const at = Array.isArray(s) ? s[0]?.checked_in_at : s?.checked_in_at;
        return at ? new Date(new Date(at).getTime() - 2 * 60000).toISOString() : undefined;
      })(),
      items: o.items.map((it) => ({ name: it.item_name, price: it.price, qty: it.qty, request: it.request })),
    }));

  // 자리이동 지시 — 마커 세션이 보유한 살아있는 포스 주문들을 새 좌석 테이블로 옮기라고
  // 내린다. 세션당 최신 마커만(연쇄 이동은 최종 목적지로 한 번에). 주문별 포스 주문 id는
  // 최신 ack(added/remap)의 toss_order_id. 구형 플러그인은 moves 필드를 무시하므로 무해.
  const latestToss = new Map<string, string>();
  for (const a of [...(acks ?? [])].sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)))) {
    const p = a.payload as { order_id?: string; toss_order_id?: unknown };
    const uuid = p?.order_id ? extractOrderUuid(p.order_id) : '';
    if (uuid && p?.toss_order_id != null) latestToss.set(uuid, String(p.toss_order_id));
  }
  const markers = (moveRows ?? []).filter(
    (m) => !acked.has(m.id) && m.session_id && m.items.some((it) => it.item_name?.startsWith('자리 이동:')),
  );
  const latestMove = new Map<string, (typeof markers)[number]>();
  for (const m of markers) latestMove.set(m.session_id as string, m); // 오름차순이라 마지막이 최신
  let moves: { id: string; to_seat: string; pos_order_ids: string[] }[] = [];
  if (latestMove.size) {
    const { data: live } = await ctx.admin
      .from('table_orders')
      .select('id, session_id')
      .eq('spot_id', ctx.spotId)
      .in('session_id', [...latestMove.keys()])
      .in('status', ['new', 'accepted'])
      .gt('total', 0);
    moves = [...latestMove.values()]
      .map((m) => ({
        id: m.id,
        to_seat: m.seat_label,
        pos_order_ids: [
          ...new Set(
            (live ?? [])
              .filter((o) => o.session_id === m.session_id)
              .map((o) => latestToss.get(o.id))
              .filter((v): v is string => Boolean(v)),
          ),
        ],
      }))
      .filter((m) => m.pos_order_ids.length); // 옮길 포스 주문이 없으면 지시 불필요
  }

  return NextResponse.json({ orders: pending, moves });
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
  // 역방향 싱크(v5.2) — 플러그인이 보고한 포스 직접 주문(직원 입력, 변경 시에만 옴)
  if (Array.isArray(body.pos_orders)) {
    if (!/^\d{1,20}$/.test(mid)) return NextResponse.json({ error: 'bad mid' }, { status: 400 });
    const posCtx = await spotForMerchant(mid);
    if (posCtx) await ingestPosOrderReports(posCtx.admin, posCtx.spotId, mid, body.pos_orders as PosOrderReport[]);
    return NextResponse.json({ ok: true }); // 미연동 매장(검수 데모)은 조용히 무시
  }

  // 플러그인은 피드의 "Q순번_uuid" id를 그대로 돌려보낸다 — 원 UUID로 복원해 처리
  const orderId = typeof body.order_id === 'string' ? extractOrderUuid(body.order_id) : '';
  const outcome = ['added', 'unmatched', 'error', 'moved'].includes(body.outcome) ? (body.outcome as string) : 'error';
  if (!/^\d{1,20}$/.test(mid) || !orderId) return NextResponse.json({ error: 'bad request' }, { status: 400 });

  const ctx = await spotForMerchant(mid);
  if (!ctx) return NextResponse.json({ error: 'not linked' }, { status: 404 });

  await ctx.admin.from('tossplace_events').insert({
    event_type: 'plugin.push.ack',
    payload: { order_id: orderId, outcome, toss_order_id: body.toss_order_id ?? null, mid },
    headers: {},
  });

  // 자리이동 완료 — 세션의 살아있는 주문들을 새 포스 주문 id로 재지정(remap ack).
  // 옛 주문 취소 웹훅을 진짜 취소로 오인하지 않고, 새 주문 완료 시 형제 완결이 되게.
  if (outcome === 'moved') {
    const newTossId = body.toss_order_id != null ? String(body.toss_order_id) : '';
    if (newTossId) {
      const { data: marker } = await ctx.admin
        .from('table_orders')
        .select('session_id')
        .eq('id', orderId)
        .eq('spot_id', ctx.spotId)
        .maybeSingle();
      if (marker?.session_id) {
        const { data: live } = await ctx.admin
          .from('table_orders')
          .select('id')
          .eq('session_id', marker.session_id)
          .in('status', ['new', 'accepted'])
          .gt('total', 0);
        if (live?.length) {
          await ctx.admin.from('tossplace_events').insert(
            live.map((o) => ({
              event_type: 'plugin.push.ack',
              payload: { order_id: o.id, outcome: 'remap', toss_order_id: newTossId, mid },
              headers: {},
            })),
          );
        }
      }
    }
    return NextResponse.json({ ok: true });
  }

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

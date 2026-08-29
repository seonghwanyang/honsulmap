import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { businessDayStart } from '@/lib/tableDay';
import { isTableTester } from '@/lib/tableTesters';
import { tossFetchAll, tossMerchantId } from '@/lib/tossplace';

// 토스 포스 주문 원본 (조회 API 응답 중 보드에 필요한 필드만)
interface TossOrderRaw {
  id: string;
  orderNumber: string;
  orderState: string;
  createdAt: string;
  lineItems?: { item?: { title?: string }; itemPrice?: { priceValue?: number }; quantity?: number }[];
}

// 주문 보드 (사장님) — 폴링 기반 (Realtime publication 설정 없이 동작).
// GET: 오늘 영업분 주문 + 좌석별 합계. PATCH: 상태 변경.
// "오늘 영업분" = 직전 새벽 6시(KST) 이후 — 새벽 장사가 전날 장부에 남게.

async function assertMember(spotId: string) {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user || !isTableTester(user.email)) return null; // 베타: 테스터만
  const admin = supabaseAdmin();
  const { data } = await admin
    .from('spot_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('spot_id', spotId)
    .maybeSingle();
  return data ? admin : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = await assertMember(id);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const [{ data: orders }, { data: occ }, { data: cfg }] = await Promise.all([
    admin
      .from('table_orders')
      .select('id, seat_label, status, total, created_at, items:table_order_items(item_name, price, qty, request, gift_target_seat)')
      .eq('spot_id', id)
      .gte('created_at', businessDayStart())
      .order('created_at', { ascending: false })
      .limit(200),
    // 미니 좌석맵용 점유 현황 — 활성 세션의 좌석 id
    admin
      .from('table_sessions')
      .select('seat_id')
      .eq('spot_id', id)
      .eq('active', true)
      .gt('expires_at', new Date().toISOString()),
    admin.from('store_table_config').select('modes').eq('spot_id', id).maybeSingle(),
  ]);

  // 토스 포스 주문 — 연동된 가게만, 오늘 영업분. 토스 장애 시 조용히 빈 배열.
  // 주의: orderStates 기본값이 [COMPLETED, CANCELLED]라 진행 중 주문이 빠진다 — 명시 필수.
  // from(영업일 시작) + 페이지네이션으로 바쁜 날 100건 초과도 보장.
  const mid = tossMerchantId(cfg?.modes);
  const wantPos = request.nextUrl.searchParams.get('pos') === '1';
  let posOrders:
    | { id: string; order_number: string; state: string; created_at: string; total: number; items: { name: string; qty: number; price: number }[] }[]
    | null = null; // null = 이번 응답엔 토스 미조회 (클라이언트가 기존 값 유지)
  if (mid && wantPos) {
    const dayStart = businessDayStart();
    const states = ['OPENED', 'COMPLETED', 'CANCELLED'].map((s) => `orderStates=${s}`).join('&');
    const raw = await tossFetchAll<TossOrderRaw>(
      `/merchants/${mid}/order/orders?from=${encodeURIComponent(dayStart)}&${states}`,
    );
    posOrders = (raw ?? [])
      .filter((o) => o.createdAt >= dayStart)
      .map((o) => {
        const items = (o.lineItems ?? []).map((li) => ({
          name: li.item?.title ?? '?',
          qty: li.quantity ?? 1,
          price: li.itemPrice?.priceValue ?? 0,
        }));
        return {
          id: o.id,
          order_number: o.orderNumber,
          state: o.orderState,
          created_at: o.createdAt,
          total: items.reduce((acc, it) => acc + it.price * it.qty, 0),
          items,
        };
      });
  }

  const list = orders ?? [];
  const seatTotals: Record<string, number> = {};
  for (const o of list) {
    if (o.status === 'canceled') continue;
    seatTotals[o.seat_label] = (seatTotals[o.seat_label] ?? 0) + (o.total ?? 0);
  }

  return NextResponse.json({
    orders: list,
    seat_totals: seatTotals,
    occupied_seat_ids: (occ ?? []).map((s) => s.seat_id),
    pos_orders: posOrders,
    toss_connected: !!mid,
  });
}

const VALID_STATUSES = ['new', 'accepted', 'done', 'canceled'] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = await assertMember(id);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  // 좌석 강제 비우기 — 원격 장난 세션/유령 점유를 보드에서 원터치로 정리.
  if (typeof body.end_seat_session === 'string' && body.end_seat_session) {
    const { error } = await admin
      .from('table_sessions')
      .update({ active: false })
      .eq('spot_id', id)
      .eq('seat_id', body.end_seat_session)
      .eq('active', true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const orderId = typeof body.order_id === 'string' ? body.order_id : '';
  const status = typeof body.status === 'string' ? body.status : '';
  if (!orderId || !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number]))
    return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const { error } = await admin
    .from('table_orders')
    .update({ status })
    .eq('id', orderId)
    .eq('spot_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

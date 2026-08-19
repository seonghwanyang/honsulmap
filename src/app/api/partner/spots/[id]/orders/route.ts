import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { businessDayStart } from '@/lib/tableDay';
import { isTableTester } from '@/lib/tableTesters';

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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = await assertMember(id);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: orders } = await admin
    .from('table_orders')
    .select('id, seat_label, status, total, created_at, items:table_order_items(item_name, price, qty, request, gift_target_seat)')
    .eq('spot_id', id)
    .gte('created_at', businessDayStart())
    .order('created_at', { ascending: false })
    .limit(200);

  const list = orders ?? [];
  const seatTotals: Record<string, number> = {};
  for (const o of list) {
    if (o.status === 'canceled') continue;
    seatTotals[o.seat_label] = (seatTotals[o.seat_label] ?? 0) + (o.total ?? 0);
  }

  return NextResponse.json({ orders: list, seat_totals: seatTotals });
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

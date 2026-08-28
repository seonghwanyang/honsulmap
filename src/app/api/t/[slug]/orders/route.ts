import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { rateLimit, clientIp } from '@/lib/rateLimit';

// 손님 주문 — 세션(체크인) 필수. 가격은 서버가 메뉴 테이블에서 다시 계산
// (클라이언트가 보낸 금액은 신뢰하지 않는다). 후불이라 결제는 없음.

async function loadContext(slug: string, sid: string | null) {
  const { data: spot } = await supabase
    .from('spots')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (!spot) return { error: NextResponse.json({ error: '가게를 찾을 수 없어요.' }, { status: 404 }) };
  if (!sid) return { error: NextResponse.json({ error: '체크인이 필요해요.' }, { status: 401 }) };

  const admin = supabaseAdmin();
  const { data: session } = await admin
    .from('table_sessions')
    .select('id, spot_id, seat_id, active, expires_at')
    .eq('id', sid)
    .maybeSingle();
  if (
    !session ||
    session.spot_id !== spot.id ||
    !session.active ||
    new Date(session.expires_at).getTime() < Date.now()
  ) {
    return { error: NextResponse.json({ error: '세션이 만료됐어요. 다시 체크인해주세요.' }, { status: 410 }) };
  }
  return { spot, session, admin };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug); // 한글 slug 대응
  const ctx = await loadContext(slug, request.nextUrl.searchParams.get('sid'));
  if ('error' in ctx) return ctx.error;
  const { session, admin } = ctx;

  const { data: orders } = await admin
    .from('table_orders')
    .select('id, status, total, created_at, items:table_order_items(item_name, price, qty, request, gift_target_seat)')
    .eq('session_id', session.id)
    .order('created_at', { ascending: false });

  const list = orders ?? [];
  const seatTotal = list
    .filter((o) => o.status !== 'canceled')
    .reduce((acc, o) => acc + (o.total ?? 0), 0);

  return NextResponse.json({ orders: list, seat_total: seatTotal });
}

interface OrderItemInput {
  id: string;
  qty: number;
  request?: string;
  gift_target_seat?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const ip = clientIp(request);
  if (!(await rateLimit('table-order:create', ip, 60, 10))) {
    return NextResponse.json({ error: '주문이 너무 잦아요. 잠시 후 다시 시도해주세요.' }, { status: 429 });
  }

  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug); // 한글 slug 대응
  const body = await request.json().catch(() => ({}));
  const ctx = await loadContext(slug, typeof body.session_id === 'string' ? body.session_id : null);
  if ('error' in ctx) return ctx.error;
  const { spot, session, admin } = ctx;

  const inputs: OrderItemInput[] = Array.isArray(body.items) ? body.items : [];
  if (!inputs.length || inputs.length > 20)
    return NextResponse.json({ error: '주문 항목이 올바르지 않아요.' }, { status: 400 });
  for (const it of inputs) {
    if (typeof it.id !== 'string' || !Number.isInteger(it.qty) || it.qty < 1 || it.qty > 20)
      return NextResponse.json({ error: '주문 항목이 올바르지 않아요.' }, { status: 400 });
  }

  const { data: menuItems } = await admin
    .from('store_menu_items')
    .select('id, name, price, sold_out, zero_action')
    .eq('spot_id', spot.id)
    .in('id', inputs.map((i) => i.id));

  const byId = new Map((menuItems ?? []).map((m) => [m.id, m]));
  for (const it of inputs) {
    const m = byId.get(it.id);
    if (!m) return NextResponse.json({ error: '메뉴에 없는 항목이 있어요.' }, { status: 400 });
    if (m.sold_out) return NextResponse.json({ error: `'${m.name}'은(는) 품절이에요.` }, { status: 409 });
  }

  const { data: seat } = await admin
    .from('store_seats')
    .select('label')
    .eq('id', session.seat_id)
    .maybeSingle();

  const total = inputs.reduce((acc, it) => acc + byId.get(it.id)!.price * it.qty, 0);

  // 멱등키 — 재시도/재탭으로 같은 주문이 두 번 들어가면 기존 주문을 성공으로 재응답.
  const clientKey =
    typeof body.client_key === 'string' && body.client_key.length > 0 && body.client_key.length <= 64
      ? body.client_key
      : null;
  const baseRow = { spot_id: spot.id, session_id: session.id, seat_label: seat?.label ?? '?', total };
  let ins = await admin
    .from('table_orders')
    .insert(clientKey ? { ...baseRow, client_key: clientKey } : baseRow)
    .select('id')
    .single();
  if (ins.error && clientKey) {
    const msg = ins.error.message ?? '';
    if (ins.error.code === '23505' || msg.includes('duplicate')) {
      const { data: dup } = await admin
        .from('table_orders')
        .select('id, total')
        .eq('client_key', clientKey)
        .maybeSingle();
      if (dup) return NextResponse.json({ ok: true, order_id: dup.id, total: dup.total, deduped: true });
    }
    // 마이그레이션(2026-08-30_order_client_key.sql) 전 — 키 없이 재시도
    if (msg.includes('client_key')) {
      ins = await admin.from('table_orders').insert(baseRow).select('id').single();
    }
  }
  const order = ins.data;
  if (ins.error || !order) return NextResponse.json({ error: ins.error?.message ?? '주문 저장에 실패했어요.' }, { status: 500 });

  const { error: iErr } = await admin.from('table_order_items').insert(
    inputs.map((it) => {
      const m = byId.get(it.id)!;
      return {
        order_id: order.id,
        item_name: m.name,
        price: m.price,
        qty: it.qty,
        request: typeof it.request === 'string' ? it.request.slice(0, 100) || null : null,
        gift_target_seat:
          m.zero_action === 'gift' && typeof it.gift_target_seat === 'string'
            ? it.gift_target_seat.slice(0, 10)
            : null,
      };
    }),
  );
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, order_id: order.id, total }, { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { rateLimit, clientIp } from '@/lib/rateLimit';

// 메뉴 행동 로그 — 담김/뺌 이벤트 (주문은 table_orders가 원장).
// "담았는데 안 시킨 메뉴" 분석용. 실패해도 손님 흐름에 영향 없게 항상 200.

const ACTIONS = ['cart_add', 'cart_remove'] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!(await rateLimit('menu-ev', clientIp(request), 60, 40))) {
    return NextResponse.json({ ok: true }); // 로그성 — 초과분은 조용히 버림
  }

  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const body = await request.json().catch(() => ({}));

  const action = ACTIONS.includes(body.action) ? (body.action as (typeof ACTIONS)[number]) : null;
  const sid = typeof body.session_id === 'string' ? body.session_id : null;
  const itemId = typeof body.item_id === 'string' ? body.item_id : null;
  const itemName = typeof body.item_name === 'string' ? body.item_name.trim().slice(0, 60) : '';
  if (!action || !sid || !itemName) return NextResponse.json({ ok: true });

  const { data: spot } = await supabase.from('spots').select('id').eq('slug', slug).maybeSingle();
  if (!spot) return NextResponse.json({ ok: true });

  const admin = supabaseAdmin();
  const { data: session } = await admin
    .from('table_sessions')
    .select('id, spot_id')
    .eq('id', sid)
    .maybeSingle();
  if (!session || session.spot_id !== spot.id) return NextResponse.json({ ok: true });

  await admin
    .from('menu_events')
    .insert({ spot_id: spot.id, session_id: session.id, item_id: itemId, item_name: itemName, action })
    .then(({ error }) => {
      if (error && error.code !== '42P01') console.warn('[menu-ev]', error.message);
    });

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { rateLimit, clientIp } from '@/lib/rateLimit';

// 좌석 이동 — 체크인 세션을 빈 좌석으로 옮긴다. 이동 사실은 ₩0 이벤트 주문으로
// 사장님 보드(서비스 요청)에 딩동과 함께 표시된다 (서빙 동선 안내용).

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!(await rateLimit('seat-move', clientIp(request), 60, 6))) {
    return NextResponse.json({ error: '이동 요청이 너무 잦아요. 잠시 후 다시 해주세요.' }, { status: 429 });
  }

  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug); // 한글 slug 대응
  const { data: spot } = await supabase.from('spots').select('id').eq('slug', slug).maybeSingle();
  if (!spot) return NextResponse.json({ error: '가게를 찾을 수 없어요.' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const sid = typeof body.session_id === 'string' ? body.session_id : null;
  const targetLabel = typeof body.seat_label === 'string' ? body.seat_label.trim().slice(0, 10) : '';
  if (!sid) return NextResponse.json({ error: '체크인이 필요해요.' }, { status: 401 });
  if (!targetLabel) return NextResponse.json({ error: '좌석 번호가 올바르지 않아요.' }, { status: 400 });

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
    return NextResponse.json({ error: '세션이 만료됐어요. 다시 체크인해주세요.' }, { status: 410 });
  }

  const { data: target } = await admin
    .from('store_seats')
    .select('id, label')
    .eq('spot_id', spot.id)
    .eq('label', targetLabel)
    .eq('active', true)
    .eq('seat_type', 'seat')
    .maybeSingle();
  if (!target) return NextResponse.json({ error: '그 좌석을 찾을 수 없어요.' }, { status: 404 });
  if (target.id === session.seat_id)
    return NextResponse.json({ error: '지금 앉아 계신 자리예요.' }, { status: 400 });

  // 대상 좌석 점유 확인 (동시 이동 레이스는 바 규모에선 허용 수준)
  const { data: occupied } = await admin
    .from('table_sessions')
    .select('id')
    .eq('seat_id', target.id)
    .eq('active', true)
    .gt('expires_at', new Date().toISOString())
    .neq('id', session.id)
    .maybeSingle();
  if (occupied) return NextResponse.json({ error: '이미 사용 중인 좌석이에요.' }, { status: 409 });

  const { data: oldSeat } = await admin
    .from('store_seats')
    .select('label')
    .eq('id', session.seat_id)
    .maybeSingle();

  const { error: upErr } = await admin
    .from('table_sessions')
    .update({ seat_id: target.id })
    .eq('id', session.id);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // 보드 알림용 ₩0 이벤트 주문 — 서비스 요청 섹션에 "자리 이동" 카드로 뜬다
  const { data: evt } = await admin
    .from('table_orders')
    .insert({ spot_id: spot.id, session_id: session.id, seat_label: target.label, total: 0 })
    .select('id')
    .single();
  if (evt) {
    await admin.from('table_order_items').insert({
      order_id: evt.id,
      item_name: `자리 이동: ${oldSeat?.label ?? '?'} → ${target.label}`,
      price: 0,
      qty: 1,
    });
  }

  return NextResponse.json({ ok: true, seat_id: target.id, seat_label: target.label });
}

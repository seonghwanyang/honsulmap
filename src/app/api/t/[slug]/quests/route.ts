import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

// 손님 퀘스트 — 활성 퀘스트 목록(+내 달성 상태) 조회, "달성했어요" 신고.
// v1은 자가신고 → 사장님 보드에 알림 → 사장님이 확인 후 보상 지급.

async function loadCtx(slug: string, sid: string | null) {
  const { data: spot } = await supabase.from('spots').select('id').eq('slug', slug).maybeSingle();
  if (!spot) return { error: NextResponse.json({ error: 'not found' }, { status: 404 }) };
  const admin = supabaseAdmin();
  if (!sid) return { spot, admin, session: null };
  const { data: session } = await admin
    .from('table_sessions')
    .select('id, spot_id, active, expires_at')
    .eq('id', sid)
    .maybeSingle();
  const valid =
    session &&
    session.spot_id === spot.id &&
    session.active &&
    new Date(session.expires_at).getTime() > Date.now();
  return { spot, admin, session: valid ? session : null };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug); // 한글 slug 대응
  const ctx = await loadCtx(slug, request.nextUrl.searchParams.get('sid'));
  if ('error' in ctx) return ctx.error;
  const { spot, admin, session } = ctx;

  const { data: quests } = await admin
    .from('store_quests')
    .select('id, title, reward, hidden')
    .eq('spot_id', spot.id)
    .eq('active', true)
    .order('hidden')
    .order('title');

  let claimed: Record<string, string> = {};
  if (session && quests?.length) {
    const { data: claims } = await admin
      .from('quest_claims')
      .select('quest_id, status')
      .eq('session_id', session.id);
    claimed = Object.fromEntries((claims ?? []).map((c) => [c.quest_id, c.status]));
  }

  return NextResponse.json({
    quests: (quests ?? []).map((q) => ({ ...q, my_status: claimed[q.id] ?? null })),
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug); // 한글 slug 대응
  const body = await request.json().catch(() => ({}));
  const ctx = await loadCtx(slug, typeof body.session_id === 'string' ? body.session_id : null);
  if ('error' in ctx) return ctx.error;
  const { spot, admin, session } = ctx;
  if (!session)
    return NextResponse.json({ error: '체크인이 필요해요.' }, { status: 401 });

  const questId = typeof body.quest_id === 'string' ? body.quest_id : '';
  const { data: quest } = await admin
    .from('store_quests')
    .select('id')
    .eq('id', questId)
    .eq('spot_id', spot.id)
    .eq('active', true)
    .maybeSingle();
  if (!quest) return NextResponse.json({ error: '퀘스트를 찾을 수 없어요.' }, { status: 404 });

  const { error } = await admin
    .from('quest_claims')
    .insert({ quest_id: quest.id, session_id: session.id });
  if (error) {
    if (error.code === '23505')
      return NextResponse.json({ error: '이미 달성 처리된 퀘스트예요.' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

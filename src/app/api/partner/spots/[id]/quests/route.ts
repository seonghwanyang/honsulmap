import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { businessDayStart } from '@/lib/tableDay';

// 퀘스트 관리 (사장님) — 목록 교체(PUT), 오늘 달성 알림 조회(GET),
// 보상 지급 처리(PATCH). 달성 카드는 주문 보드에 함께 뜬다.

async function assertMember(spotId: string) {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return null;
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

  const [{ data: quests }, { data: claims }] = await Promise.all([
    admin.from('store_quests').select('*').eq('spot_id', id).order('hidden').order('title'),
    admin
      .from('quest_claims')
      .select('id, status, claimed_at, quest:store_quests!inner(spot_id, title, reward), session:table_sessions(seat_id)')
      .eq('quest.spot_id', id)
      .gte('claimed_at', businessDayStart())
      .order('claimed_at', { ascending: false }),
  ]);

  // 세션 좌석 라벨 해석
  const seatIds = [...new Set((claims ?? []).map((c) => (c.session as { seat_id?: string } | null)?.seat_id).filter(Boolean))] as string[];
  const { data: seats } = seatIds.length
    ? await admin.from('store_seats').select('id, label').in('id', seatIds)
    : { data: [] };
  const seatLabel = new Map((seats ?? []).map((s) => [s.id, s.label]));

  return NextResponse.json({
    quests: quests ?? [],
    claims: (claims ?? []).map((c) => {
      const q = c.quest as unknown as { title: string; reward: string };
      const sess = c.session as { seat_id?: string } | null;
      return {
        id: c.id,
        status: c.status,
        claimed_at: c.claimed_at,
        title: q?.title ?? '',
        reward: q?.reward ?? '',
        seat_label: sess?.seat_id ? (seatLabel.get(sess.seat_id) ?? '?') : '?',
      };
    }),
  });
}

interface QuestInput {
  title: string;
  reward: string;
  hidden?: boolean;
  active?: boolean;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = await assertMember(id);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const quests: QuestInput[] = Array.isArray(body?.quests) ? body.quests : [];
  if (quests.length > 20)
    return NextResponse.json({ error: '퀘스트는 최대 20개예요.' }, { status: 400 });
  for (const q of quests) {
    if (!q.title?.trim() || q.title.length > 60)
      return NextResponse.json({ error: '퀘스트 제목을 1~60자로 입력해주세요.' }, { status: 400 });
    if (!q.reward?.trim() || q.reward.length > 60)
      return NextResponse.json({ error: '보상을 1~60자로 입력해주세요.' }, { status: 400 });
  }

  // 전량 교체 — 달성 이력(quest_claims)은 CASCADE로 함께 정리되므로
  // 편집은 영업 전에 하는 것을 UI에서 안내한다.
  const { error: delErr } = await admin.from('store_quests').delete().eq('spot_id', id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (quests.length) {
    const { error } = await admin.from('store_quests').insert(
      quests.map((q) => ({
        spot_id: id,
        title: q.title.trim(),
        reward: q.reward.trim(),
        hidden: !!q.hidden,
        active: q.active !== false,
      })),
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = await assertMember(id);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const claimId = typeof body.claim_id === 'string' ? body.claim_id : '';
  if (!claimId) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  // spot 소속 검증: 해당 spot 퀘스트의 클레임만 갱신
  const { data: claim } = await admin
    .from('quest_claims')
    .select('id, quest:store_quests!inner(spot_id)')
    .eq('id', claimId)
    .maybeSingle();
  if (!claim || (claim.quest as unknown as { spot_id: string })?.spot_id !== id)
    return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { error } = await admin.from('quest_claims').update({ status: 'rewarded' }).eq('id', claimId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

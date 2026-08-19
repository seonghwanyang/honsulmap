import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { businessDayStart } from '@/lib/tableDay';
import { isTableTester } from '@/lib/tableTesters';

// 영업 마감 — 활성 세션 전부 종료 + 프로필 필드 즉시 익명화
// ("개인정보는 영업 종료 후 만료" 약속의 집행 지점). 오늘 장사 요약을 돌려준다.

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user || !isTableTester(user.email))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 }); // 베타: 테스터만

  const admin = supabaseAdmin();
  const { data: member } = await admin
    .from('spot_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('spot_id', id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: closed, error } = await admin
    .from('table_sessions')
    .update({
      active: false,
      expires_at: new Date().toISOString(),
      mbti: null,
      purpose: null,
      vibe: null,
      tmi: null,
      drink_pref: null,
    })
    .eq('spot_id', id)
    .eq('active', true)
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: orders } = await admin
    .from('table_orders')
    .select('status, total')
    .eq('spot_id', id)
    .gte('created_at', businessDayStart());

  const valid = (orders ?? []).filter((o) => o.status !== 'canceled');
  return NextResponse.json({
    ok: true,
    sessions_closed: closed?.length ?? 0,
    orders_count: valid.length,
    orders_total: valid.reduce((a, o) => a + (o.total ?? 0), 0),
  });
}

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

  const dayStart = businessDayStart();

  // 익명화 직전 집계 스냅샷 — 개인 행은 남기지 않고 분포만 (spot_day_stats).
  const { data: todaySessions } = await admin
    .from('table_sessions')
    .select('gender, age_band, purpose, vibe')
    .eq('spot_id', id)
    .gte('checked_in_at', dayStart);

  const { data: orders } = await admin
    .from('table_orders')
    .select('status, total')
    .eq('spot_id', id)
    .gte('created_at', dayStart);

  const valid = (orders ?? []).filter((o) => o.status !== 'canceled');
  const ordersTotal = valid.reduce((a, o) => a + (o.total ?? 0), 0);

  const tally = (key: 'gender' | 'age_band' | 'purpose' | 'vibe') =>
    (todaySessions ?? []).reduce<Record<string, number>>((m, r) => {
      const v = r[key];
      if (v) m[v] = (m[v] ?? 0) + 1;
      return m;
    }, {});
  // 마이그레이션 전(테이블 없음)이면 조용히 스킵
  await admin
    .from('spot_day_stats')
    .upsert(
      {
        spot_id: id,
        business_day_start: dayStart,
        stats: {
          sessions: todaySessions?.length ?? 0,
          by_gender: tally('gender'),
          by_age: tally('age_band'),
          by_purpose: tally('purpose'),
          by_vibe: tally('vibe'),
          orders_count: valid.length,
          orders_total: ordersTotal,
        },
      },
      { onConflict: 'spot_id,business_day_start' },
    )
    .then(({ error: sErr }) => {
      if (sErr && sErr.code !== '42P01') console.warn('[day-stats]', sErr.message);
    });

  // 오늘 체크인한 세션 전체의 민감 프로필 익명화 (체크아웃돼 비활성인 것 포함)
  const { error: wipeErr } = await admin
    .from('table_sessions')
    .update({ mbti: null, purpose: null, vibe: null, tmi: null, drink_pref: null })
    .eq('spot_id', id)
    .gte('checked_in_at', dayStart);
  if (wipeErr) return NextResponse.json({ error: wipeErr.message }, { status: 500 });

  const { data: closed, error } = await admin
    .from('table_sessions')
    .update({ active: false, expires_at: new Date().toISOString() })
    .eq('spot_id', id)
    .eq('active', true)
    .select('id');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    sessions_closed: closed?.length ?? 0,
    orders_count: valid.length,
    orders_total: ordersTotal,
  });
}

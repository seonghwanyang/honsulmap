import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { businessDayStart } from '@/lib/tableDay';

// 일일 자동 마감 크론 (매일 08:10 KST, vercel.json) — 사장님이 마감 버튼을 안 눌러도
// "개인정보는 영업 종료 후 자동 만료" 약속을 집행한다:
//   1) 어제 영업분 통계 스냅샷 (마감 버튼이 이미 남긴 날은 건너뜀 — ignoreDuplicates)
//   2) 만료 세션 프로필 익명화 (mbti·목적·분위기·TMI·선호주 — 성별/나이대는 통계용 유지)
//   3) 만료됐는데 active로 남은 세션 정리
// 최근 7일을 쓸어 크론이 하루 죽어도 다음 날 따라잡는다.

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = supabaseAdmin();
  const now = new Date().toISOString();
  const todayStart = businessDayStart(); // 오늘 08:00 KST — 어제 영업분의 끝
  const yesterdayStart = new Date(Date.parse(todayStart) - 24 * 3600_000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();

  // ── 1) 어제 영업분 스냅샷 (익명화 전에) ──
  const { data: ySessions } = await admin
    .from('table_sessions')
    .select('spot_id, gender, age_band, purpose, vibe')
    .gte('checked_in_at', yesterdayStart)
    .lt('checked_in_at', todayStart);
  const { data: yOrders } = await admin
    .from('table_orders')
    .select('spot_id, status, total')
    .gte('created_at', yesterdayStart)
    .lt('created_at', todayStart);

  const spotIds = [...new Set((ySessions ?? []).map((s) => s.spot_id))];
  for (const spotId of spotIds) {
    const rows = (ySessions ?? []).filter((s) => s.spot_id === spotId);
    const orders = (yOrders ?? []).filter((o) => o.spot_id === spotId && o.status !== 'canceled');
    const tally = (key: 'gender' | 'age_band' | 'purpose' | 'vibe') =>
      rows.reduce<Record<string, number>>((m, r) => {
        const v = r[key];
        if (v) m[v] = (m[v] ?? 0) + 1;
        return m;
      }, {});
    await admin
      .from('spot_day_stats')
      .upsert(
        {
          spot_id: spotId,
          business_day_start: yesterdayStart,
          stats: {
            sessions: rows.length,
            by_gender: tally('gender'),
            by_age: tally('age_band'),
            by_purpose: tally('purpose'),
            by_vibe: tally('vibe'),
            orders_count: orders.length,
            orders_total: orders.reduce((a, o) => a + (o.total ?? 0), 0),
          },
        },
        { onConflict: 'spot_id,business_day_start', ignoreDuplicates: true }, // 마감 버튼 스냅샷 보존
      )
      .then(({ error }) => {
        if (error && error.code !== '42P01') console.warn('[cron day-close] stats', spotId, error.message);
      });
  }

  // ── 2+3) 만료 세션 익명화 + active 정리 (최근 7일, 멱등) ──
  const { data: wiped, error: wipeErr } = await admin
    .from('table_sessions')
    .update({ mbti: null, purpose: null, vibe: null, tmi: null, drink_pref: null, active: false })
    .lt('expires_at', now)
    .gte('checked_in_at', weekAgo)
    .select('id');
  if (wipeErr) return NextResponse.json({ error: wipeErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, spots: spotIds.length, sessions_wiped: wiped?.length ?? 0 });
}

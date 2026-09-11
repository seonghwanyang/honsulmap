import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { reportError, serverError } from '@/lib/serverError';
import { supabaseAdmin } from '@/lib/supabase';
import { businessDayStart } from '@/lib/tableDay';
import { cancelStaleApiOrders } from '@/lib/tossplace';

// 일일 자동 마감 크론 (매일 08:10 KST, vercel.json) — 사장님이 마감 버튼을 안 눌러도
// "개인정보는 영업 종료 후 자동 만료" 약속을 집행한다:
//   1) 어제 영업분 통계 스냅샷 (마감 버튼이 이미 남긴 날은 건너뜀 — ignoreDuplicates)
//   2) 만료 세션 프로필 익명화 (mbti·목적·분위기·TMI·선호주 — 성별/나이대는 통계용 유지)
//   3) 만료됐는데 active로 남은 세션 정리
// 최근 7일을 쓸어 크론이 하루 죽어도 다음 날 따라잡는다.

// 평소엔 2초(09-11 실측)지만 5단계 토스 잔재 청소는 잔재 건수만큼 토스 호출(건당 최대 5초)이 늘어
// 잔재가 많은 날은 수십 초가 된다. 기본 한도(플랜·설정에 따라 15초)에 잘리지 않게 넉넉히 준다.
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Sentry Cron Monitor — 매일 23:10 UTC(08:10 KST)에 체크인이 없거나 throw로 끝나면 메일.
  // Turbopack 빌드라 automaticVercelMonitors(webpack 전용)를 못 써서 여기서 직접 감싼다.
  // 5xx를 return하는 경로는 serverError()가 따로 보고한다.
  const res = await Sentry.withMonitor('day-close', runDayClose, {
    schedule: { type: 'crontab', value: '10 23 * * *' },
    checkinMargin: 10,
    maxRuntime: 10,
    timezone: 'Etc/UTC',
  });
  // 서버리스는 응답 직후 얼어붙을 수 있어 마지막 "ok" 체크인이 유실될 수 있다 — 보내고 나서 응답.
  await Sentry.flush(2000);
  return res;
}

async function runDayClose() {
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
        if (error && error.code !== '42P01') {
          console.warn('[cron day-close] stats', spotId, error.message);
          reportError(error, { level: 'warning', extra: { where: 'day-close stats', spotId } });
        }
      });
  }

  // ── 2+3) 만료 세션 익명화 + active 정리 (최근 7일, 멱등) ──
  const { data: wiped, error: wipeErr } = await admin
    .from('table_sessions')
    .update({ mbti: null, purpose: null, vibe: null, tmi: null, drink_pref: null, active: false })
    .lt('expires_at', now)
    .gte('checked_in_at', weekAgo)
    .select('id');
  if (wipeErr) return serverError(wipeErr);

  // ── 4) 지난 영업분 미완료 주문 자동 마감 — 수동 마감 버튼과 동일 규칙.
  // 보드 잔재 방지 (마감 버튼을 안 누른 가게도 아침이면 보드가 깨끗하게).
  const { data: doneOrders } = await admin
    .from('table_orders')
    .update({ status: 'done' })
    .lt('created_at', todayStart)
    .gte('created_at', weekAgo)
    .in('status', ['new', 'accepted'])
    .select('id');

  // ── 5) 포스 잔재 청소 — 우리 API 생성 현황행(좌석N)이 지난 영업분에 열린 채 남은 것
  // 취소. 플러그인·포스 생성 계산서는 취소 채널이 없어(403) 매장에서 정리해야 한다.
  const { data: cfgs } = await admin
    .from('store_table_config')
    .select('spot_id, modes')
    .not('modes->>toss_merchant_id', 'is', null);
  let posCancelled = 0;
  for (const c of cfgs ?? []) {
    const mid = String((c.modes as { toss_merchant_id?: string } | null)?.toss_merchant_id ?? '');
    if (!/^\d{1,20}$/.test(mid)) continue;
    posCancelled += await cancelStaleApiOrders(mid, todayStart);
  }

  return NextResponse.json({
    ok: true,
    spots: spotIds.length,
    sessions_wiped: wiped?.length ?? 0,
    orders_closed: doneOrders?.length ?? 0,
    pos_stale_cancelled: posCancelled,
  });
}

import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

// 가게 분석(CRM) — 이미 수집 중인 데이터만 집계해서 사장님에게 돌려준다.
// 새 수집 없음: spot_day_stats(마감 롤업) + spot_checkin_visits(재방문) +
// table_orders/items(주문·매출) + table_sessions(시간대) + benefit_redemptions/favorites(유입).
// 세그먼트 기준은 상단 상수로 뺐다 — 파일럿 보며 조정.

const DAY = 86400_000;
const STATS_DAYS = 30; // 추이·구성·성향 집계 창
const GUEST_DAYS = 60; // 세그먼트/재방문 창 (휴면까지 보려면 넉넉히)

// 세그먼트 임계 (recency=마지막 방문 경과일, freq=방문한 영업일 수)
const ACTIVE_RECENCY = 14;
const DORMANT_RECENCY = 30;
const VIP_RATIO = 0.1; // 매출 상위 10%

type Tally = Record<string, number>;
type DayStat = {
  sessions?: number;
  by_gender?: Tally;
  by_age?: Tally;
  by_purpose?: Tally;
  by_vibe?: Tally;
  orders_count?: number;
  orders_total?: number;
};

async function requireMember(id: string) {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user)
    return { error: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) } as const;
  const admin = supabaseAdmin();
  const { data: member } = await admin
    .from('spot_members')
    .select('role')
    .eq('spot_id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member)
    return { error: NextResponse.json({ error: '권한이 없어요.' }, { status: 403 }) } as const;
  return { admin } as const;
}

const mergeTally = (into: Tally, from?: Tally) => {
  for (const [k, v] of Object.entries(from ?? {})) into[k] = (into[k] ?? 0) + (Number(v) || 0);
  return into;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMember(id);
  if ('error' in ctx) return ctx.error;
  const { admin } = ctx;

  const { data: spotRow } = await admin
    .from('spots')
    .select('name')
    .eq('id', id)
    .maybeSingle<{ name: string }>();

  const now = Date.now();
  const statsFrom = new Date(now - STATS_DAYS * DAY).toISOString();
  const guestFrom = new Date(now - GUEST_DAYS * DAY).toISOString();
  const d7 = new Date(now - 7 * DAY).toISOString();

  // 마이그레이션 전(테이블 없음, code 42P01)이면 빈 배열로 흡수 — 어떤 쿼리도 페이지를 죽이지 않게.
  const safe = async <T>(p: PromiseLike<{ data: T[] | null }>): Promise<T[]> => {
    try {
      const { data } = await p;
      return data ?? [];
    } catch {
      return [];
    }
  };
  const safeCount = async (p: PromiseLike<{ count: number | null }>): Promise<number> => {
    try {
      const { count } = await p;
      return count ?? 0;
    } catch {
      return 0;
    }
  };

  const [
    dayRows,
    visitRows,
    sessionRows,
    orderRows,
    itemRows,
    liveSeats,
    liveSessions,
    cfgRows,
    redeemTotal,
    redeem7,
    favTotal,
    views30,
  ] = await Promise.all([
    safe<{ business_day_start: string; stats: DayStat }>(
      admin
        .from('spot_day_stats')
        .select('business_day_start, stats')
        .eq('spot_id', id)
        .gte('business_day_start', statsFrom)
        .order('business_day_start', { ascending: true }),
    ),
    safe<{ guest_key: string; business_day_start: string; user_id: string | null }>(
      admin
        .from('spot_checkin_visits')
        .select('guest_key, business_day_start, user_id')
        .eq('spot_id', id)
        .gte('business_day_start', guestFrom),
    ),
    safe<{ id: string; phone4_hash: string | null; checked_in_at: string }>(
      admin
        .from('table_sessions')
        .select('id, phone4_hash, checked_in_at')
        .eq('spot_id', id)
        .gte('checked_in_at', statsFrom),
    ),
    safe<{ session_id: string | null; total: number | null }>(
      admin
        .from('table_orders')
        .select('session_id, total')
        .eq('spot_id', id)
        .neq('status', 'canceled')
        .gte('created_at', statsFrom),
    ),
    safe<{ item_name: string; price: number | null; qty: number | null }>(
      admin
        .from('table_order_items')
        .select('item_name, price, qty, table_orders!inner(spot_id, status, created_at)')
        .eq('table_orders.spot_id', id)
        .neq('table_orders.status', 'canceled')
        .gte('table_orders.created_at', statsFrom),
    ),
    safeCount(
      admin
        .from('store_seats')
        .select('id', { count: 'exact', head: true })
        .eq('spot_id', id)
        .eq('seat_type', 'seat'),
    ),
    safeCount(
      admin
        .from('table_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('spot_id', id)
        .eq('active', true),
    ),
    safe<{ live_status: string | null }>(
      admin.from('store_table_config').select('live_status').eq('spot_id', id).limit(1),
    ),
    safeCount(
      admin.from('benefit_redemptions').select('id', { count: 'exact', head: true }).eq('spot_id', id),
    ),
    safeCount(
      admin
        .from('benefit_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('spot_id', id)
        .gte('redeemed_at', d7),
    ),
    safeCount(admin.from('favorites').select('user_id', { count: 'exact', head: true }).eq('spot_id', id)),
    safeCount(
      admin
        .from('spot_views')
        .select('id', { count: 'exact', head: true })
        .eq('spot_id', id)
        .gte('created_at', statsFrom),
    ),
  ]);

  // ── 일별 추이 (최근 14 영업일) + KPI(최근 7 vs 직전 7 영업일) ──
  const daily = dayRows.map((r) => ({
    day: r.business_day_start,
    visitors: r.stats?.sessions ?? 0,
    revenue: r.stats?.orders_total ?? 0,
    orders: r.stats?.orders_count ?? 0,
  }));
  const last14 = daily.slice(-14);
  const sumRange = (arr: typeof daily, key: 'visitors' | 'revenue') =>
    arr.reduce((a, r) => a + r[key], 0);
  const recent7 = daily.slice(-7);
  const prev7 = daily.slice(-14, -7);
  const visitors7 = sumRange(recent7, 'visitors');
  const revenue7 = sumRange(recent7, 'revenue');

  // ── 구성·성향 (창 전체 합산) ──
  const gender: Tally = {};
  const age: Tally = {};
  const purpose: Tally = {};
  const vibe: Tally = {};
  for (const r of dayRows) {
    mergeTally(gender, r.stats?.by_gender);
    mergeTally(age, r.stats?.by_age);
    mergeTally(purpose, r.stats?.by_purpose);
    mergeTally(vibe, r.stats?.by_vibe);
  }

  // ── 손님별 매출 (order → session.phone4_hash) ──
  const sessGuest = new Map<string, string>();
  for (const s of sessionRows) if (s.phone4_hash) sessGuest.set(s.id, s.phone4_hash);
  const guestMonetary = new Map<string, number>();
  for (const o of orderRows) {
    const g = o.session_id ? sessGuest.get(o.session_id) : undefined;
    if (!g) continue;
    guestMonetary.set(g, (guestMonetary.get(g) ?? 0) + (Number(o.total) || 0));
  }

  // ── 세그먼트·재방문·고객 리스트 (spot_checkin_visits 그룹핑) ──
  type G = { key: string; freq: number; last: number; linked: boolean };
  const guests = new Map<string, G>();
  for (const v of visitRows) {
    const t = Date.parse(v.business_day_start);
    const g = guests.get(v.guest_key);
    if (g) {
      g.freq += 1;
      if (t > g.last) g.last = t;
      if (v.user_id) g.linked = true;
    } else {
      guests.set(v.guest_key, { key: v.guest_key, freq: 1, last: t, linked: !!v.user_id });
    }
  }
  const seg = { new: 0, active: 0, atRisk: 0, dormant: 0, vip: 0 };
  const classify = (g: G): 'new' | 'active' | 'atRisk' | 'dormant' => {
    const recency = Math.floor((now - g.last) / DAY);
    if (recency > DORMANT_RECENCY) return 'dormant';
    if (g.freq === 1) return 'new';
    return recency <= ACTIVE_RECENCY ? 'active' : 'atRisk';
  };
  const glist = [...guests.values()];
  for (const g of glist) seg[classify(g)] += 1;
  // VIP = 매출 상위 10% (매출>0 손님 중)
  const paying = glist
    .map((g) => ({ g, m: guestMonetary.get(g.key) ?? 0 }))
    .filter((x) => x.m > 0)
    .sort((a, b) => b.m - a.m);
  seg.vip = Math.min(paying.length, Math.ceil(paying.length * VIP_RATIO));
  const vipKeys = new Set(paying.slice(0, seg.vip).map((x) => x.g.key));

  const repeatRate =
    glist.length > 0 ? Math.round((glist.filter((g) => g.freq >= 2).length / glist.length) * 100) : null;

  // 고객 리스트 — 최근 방문 순 상위 24. 기기키는 4자만 노출(익명 유지).
  const segLabel = (g: G): string => (vipKeys.has(g.key) ? 'vip' : classify(g));
  const customers = glist
    .sort((a, b) => b.last - a.last)
    .slice(0, 24)
    .map((g) => ({
      key: g.key.slice(0, 4).toUpperCase(),
      linked: g.linked,
      segment: segLabel(g),
      visits: g.freq,
      lastDays: Math.floor((now - g.last) / DAY),
      total: guestMonetary.get(g.key) ?? 0,
    }));

  // ── 메뉴 랭킹 (수량·매출) — ₩0 카드 제외, "[포스]" 접두 정리 ──
  const menuMap = new Map<string, { qty: number; revenue: number }>();
  for (const it of itemRows) {
    const price = Number(it.price) || 0;
    const qty = Number(it.qty) || 0;
    if (price <= 0 || qty <= 0) continue;
    const name = it.item_name.replace(/^\[포스\]\s*/, '').slice(0, 40) || '(무명)';
    const m = menuMap.get(name) ?? { qty: 0, revenue: 0 };
    m.qty += qty;
    m.revenue += price * qty;
    menuMap.set(name, m);
  }
  const menu = [...menuMap.entries()]
    .map(([name, m]) => ({ name, ...m }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);

  // ── 시간대 히트맵 [요일 월..일][버킷 17/19/21/23/1시/그외] ──
  const heatmap: number[][] = Array.from({ length: 7 }, () => new Array(6).fill(0));
  const bucketOf = (h: number) =>
    h >= 17 && h <= 18 ? 0 : h >= 19 && h <= 20 ? 1 : h >= 21 && h <= 22 ? 2 : h === 23 || h === 0 ? 3 : h >= 1 && h <= 2 ? 4 : 5;
  for (const s of sessionRows) {
    const kst = new Date(Date.parse(s.checked_in_at) + 9 * 3600_000);
    const dow = (kst.getUTCDay() + 6) % 7; // 월=0 .. 일=6
    heatmap[dow][bucketOf(kst.getUTCHours())] += 1;
  }

  return NextResponse.json({
    name: spotRow?.name ?? null,
    updatedThru: dayRows.at(-1)?.business_day_start ?? null,
    hasData: dayRows.length > 0 || glist.length > 0 || orderRows.length > 0,
    live: {
      active: liveSessions,
      seats: liveSeats,
      status: cfgRows[0]?.live_status ?? null,
    },
    kpi: {
      visitors7,
      visitorsPrev7: sumRange(prev7, 'visitors'),
      revenue7,
      revenuePrev7: sumRange(prev7, 'revenue'),
      avgTicket: visitors7 > 0 ? Math.round(revenue7 / visitors7) : 0,
      repeatRate,
    },
    daily: last14,
    demographics: { gender, age },
    disposition: { purpose, vibe },
    heatmap,
    segments: seg,
    customers,
    menu,
    attribution: {
      redemptions: redeemTotal,
      redemptions7: redeem7,
      favorites: favTotal,
      views30,
    },
  });
}

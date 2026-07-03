import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getRegionLabel, getCategoryLabel } from '@/lib/utils';

// 사장님 통계(개편) — 절대 수치 대신 '같은 지역·업종 대비' + '전국(같은 업종) 대비'
// 순위/상위%로. 실제 카운트가 작아도 상대평가라 초라해 보이지 않게. 사장님만.
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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMember(id);
  if ('error' in ctx) return ctx.error;
  const { admin } = ctx;

  const { data: spot } = await admin
    .from('spots')
    .select('region, category, city, like_count')
    .eq('id', id)
    .maybeSingle<{ region: string; category: string; city: string | null; like_count: number | null }>();
  if (!spot) return NextResponse.json({ error: '가게를 찾을 수 없습니다.' }, { status: 404 });

  // 전국(같은 업종) 전체를 한 번에 — 지역 코호트는 여기서 region 필터로 파생.
  const { data: natRows } = await admin
    .from('spots')
    .select('id, region, like_count')
    .eq('category', spot.category);
  const nationalRows = (natRows ?? []) as { id: string; region: string; like_count: number | null }[];
  const nationalIds = nationalRows.map((r) => r.id);
  const regionIds = nationalRows.filter((r) => r.region === spot.region).map((r) => r.id);

  const [{ data: vcRows }, { data: visRows }] = await Promise.all([
    admin.from('spot_view_counts').select('spot_id, views').in('spot_id', nationalIds),
    admin.from('spot_visit_counts').select('spot_id, visits').in('spot_id', nationalIds),
  ]);
  const viewsMap = new Map(
    ((vcRows ?? []) as { spot_id: string; views: number | null }[]).map((r) => [r.spot_id, r.views ?? 0]),
  );
  const visitsMap = new Map(
    ((visRows ?? []) as { spot_id: string; visits: number | null }[]).map((r) => [r.spot_id, r.visits ?? 0]),
  );
  const likeMap = new Map(nationalRows.map((r) => [r.id, r.like_count ?? 0]));

  const rankIn = (ids: string[], map: Map<string, number>, mine: number) => {
    let greater = 0;
    for (const cid of ids) if ((map.get(cid) ?? 0) > mine) greater++;
    return greater + 1;
  };
  const ranksFor = (ids: string[]) => {
    if (ids.length < 3) return null; // 표본 3곳 미만이면 순위 무의미
    const mk = (rank: number) => ({ rank, topPct: Math.max(1, Math.round((rank / ids.length) * 100)) });
    return {
      views: mk(rankIn(ids, viewsMap, viewsMap.get(id) ?? 0)),
      likes: mk(rankIn(ids, likeMap, likeMap.get(id) ?? 0)),
      visits: mk(rankIn(ids, visitsMap, visitsMap.get(id) ?? 0)),
    };
  };

  // 주간 조회 추세 — 이번 7일 vs 지난 7일.
  const now = Date.now();
  const d7 = new Date(now - 7 * 86400000).toISOString();
  const d14 = new Date(now - 14 * 86400000).toISOString();
  const [{ count: c7 }, { count: cPrev }] = await Promise.all([
    admin
      .from('spot_views')
      .select('id', { count: 'exact', head: true })
      .eq('spot_id', id)
      .gte('created_at', d7),
    admin
      .from('spot_views')
      .select('id', { count: 'exact', head: true })
      .eq('spot_id', id)
      .gte('created_at', d14)
      .lt('created_at', d7),
  ]);
  const views7d = c7 ?? 0;
  const prev7d = cPrev ?? 0;
  const trendPct = prev7d > 0 ? Math.round(((views7d - prev7d) / prev7d) * 100) : null;

  const cityLabel = spot.city === 'seoul' ? '서울' : '제주';
  const cat = getCategoryLabel(spot.category);

  return NextResponse.json({
    region: {
      name: getRegionLabel(spot.region),
      label: `${cityLabel} ${getRegionLabel(spot.region)} ${cat}`,
      size: regionIds.length,
      ranks: ranksFor(regionIds),
    },
    national: {
      label: `전국 ${cat}`,
      size: nationalIds.length,
      ranks: ranksFor(nationalIds),
    },
    trend: { views7d, prev7d, pct: trendPct },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { assertAdmin } from '@/lib/adminAuth';

// 운영자 성과 대시보드 (playbook §북극성) — 형과 사장이 "같은 숫자"를 보게 하는 쪽의
// 형 쪽 화면. 북극성 = 혼술맵 경유 방문(체크인+리딤). 유료화 트리거 판단용.
export async function GET(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const db = supabaseAdmin();
  const now = Date.now();
  const d7 = new Date(now - 7 * 86400000).toISOString();
  const d28 = new Date(now - 28 * 86400000).toISOString();

  const [
    { count: redemptionsTotal },
    { count: redemptions7d },
    { count: visits7d },
    { count: views7d },
    { count: favoritesTotal },
    { count: benefitsActive },
    { count: chatRoomsOpen },
    { data: memberRows },
    { data: recentRedemptions },
  ] = await Promise.all([
    db.from('benefit_redemptions').select('id', { count: 'exact', head: true }),
    db.from('benefit_redemptions').select('id', { count: 'exact', head: true }).gte('redeemed_at', d7),
    db.from('spot_visits').select('id', { count: 'exact', head: true }).gte('created_at', d7),
    db.from('spot_views').select('id', { count: 'exact', head: true }).gte('created_at', d7),
    db.from('favorites').select('user_id', { count: 'exact', head: true }),
    db
      .from('spots')
      .select('id', { count: 'exact', head: true })
      .eq('benefit_active', true)
      .not('benefit_title', 'is', null),
    db.from('chat_rooms').select('spot_id', { count: 'exact', head: true }).eq('is_open', true),
    db.from('spot_members').select('spot_id, user_id'),
    db
      .from('benefit_redemptions')
      .select('spot_id, benefit_title, method, redeemed_at')
      .gte('redeemed_at', d28)
      .order('redeemed_at', { ascending: false })
      .limit(500),
  ]);

  const claimedSpots = new Set((memberRows ?? []).map((m) => m.spot_id as string)).size;
  const owners = new Set((memberRows ?? []).map((m) => m.user_id as string)).size;

  // 최근 4주 리딤을 가게별로 묶어 상위 기여 가게 테이블 구성.
  const redemptionRows = (recentRedemptions ?? []) as {
    spot_id: string;
    benefit_title: string;
    method: string;
    redeemed_at: string;
  }[];
  const bySpot = new Map<string, number>();
  for (const r of redemptionRows) bySpot.set(r.spot_id, (bySpot.get(r.spot_id) ?? 0) + 1);

  const topIds = [...bySpot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([id]) => id);
  const nameMap = new Map<string, { name: string; slug: string }>();
  if (topIds.length) {
    const { data: spots } = await db.from('spots').select('id, name, slug').in('id', topIds);
    for (const s of spots ?? []) nameMap.set(s.id, { name: s.name, slug: s.slug });
  }
  const topSpots = topIds.map((id) => ({
    spot_id: id,
    name: nameMap.get(id)?.name ?? '(삭제됨)',
    slug: nameMap.get(id)?.slug ?? '',
    redemptions_28d: bySpot.get(id) ?? 0,
  }));

  // 주별 리딤 추이 (최근 4주, 월요일 시작).
  const weekly: { week: string; count: number }[] = [];
  for (let w = 3; w >= 0; w--) {
    const start = new Date(now - (w + 1) * 7 * 86400000);
    const end = new Date(now - w * 7 * 86400000);
    const count = redemptionRows.filter((r) => {
      const t = new Date(r.redeemed_at).getTime();
      return t >= start.getTime() && t < end.getTime();
    }).length;
    weekly.push({ week: `${start.getMonth() + 1}/${start.getDate()}~`, count });
  }

  return NextResponse.json({
    northStar: {
      redemptions_total: redemptionsTotal ?? 0,
      redemptions_7d: redemptions7d ?? 0,
      visits_7d: visits7d ?? 0,
    },
    supply: {
      claimed_spots: claimedSpots,
      owners,
      benefits_active: benefitsActive ?? 0,
      chat_rooms_open: chatRoomsOpen ?? 0,
    },
    demand: {
      views_7d: views7d ?? 0,
      favorites_total: favoritesTotal ?? 0,
    },
    weekly_redemptions: weekly,
    top_spots: topSpots,
  });
}

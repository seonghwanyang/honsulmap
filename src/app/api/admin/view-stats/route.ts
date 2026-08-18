import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { assertAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// 광고 그룹 — MapClient의 AD_BANNERS와 짝. adDate = 배너가 main(프로덕션)에
// 머지된 날(KST) = 실제 노출 시작일.
const AD_GROUPS = [
  { key: 'jimuninsik', label: '지문인식(프차)', adDate: '2026-07-09', match: (ig: string) => /^jimuninsik/.test(ig) },
  { key: 'the_editor', label: '엮은이(서귀포)', adDate: '2026-07-14', match: (ig: string) => /^the_editor/.test(ig) },
  { key: 'dalbam', label: '달밤(이태원)', adDate: '2026-07-30', match: (ig: string) => ig === 'dalbam_seoul_itaewon' },
  { key: 'nowave', label: '노웨이브(프차)', adDate: '2026-07-30', match: (ig: string) => /^nowavebar/.test(ig) },
] as const;

// 최초 광고(7/9)의 "전 7일" 윈도까지 커버하는 고정 시작일.
const SINCE_DAY = '2026-06-25';

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const kstDay = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);

type Daily = Record<string, number>;
const windowStats = (daily: Daily, d0: string, d1: string) => {
  let sum = 0;
  let days = 0;
  for (let d = d0; d <= d1; d = addDays(d, 1)) { sum += daily[d] ?? 0; days += 1; }
  return { avg: days ? sum / days : 0, sum, days };
};
const pct = (before: number, after: number) => (before > 0 ? ((after - before) / before) * 100 : null);

// PostgREST Max Rows(1000) 대응 페이지네이션 수집.
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from <= 200_000; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function GET(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const sb = supabaseAdmin();
  try {
    // 집계는 DB 뷰(spot_views_daily / story_counts_daily, KST 일별)에서 끝내고
    // 라우트는 (spot_id, day, count) 소량 행만 읽는다. 원본 이벤트(수만 행)를
    // 통째 나르던 예전 방식 대비 왕복/전송량이 한 자릿수로 줄어든다.
    // 마이그레이션: src/data/migrations/2026-08-18_view_stats_daily.sql
    const [spots, viewDaily, storyDaily] = await Promise.all([
      fetchAll<{ id: string; name: string; city: string | null; instagram_id: string | null }>(
        (a, b) => sb.from('spots').select('id, name, city, instagram_id').order('id').range(a, b),
      ),
      fetchAll<{ spot_id: string; day: string; views: number }>(
        (a, b) => sb.from('spot_views_daily').select('spot_id, day, views').gte('day', SINCE_DAY).order('spot_id').order('day').range(a, b),
      ),
      fetchAll<{ spot_id: string; day: string; stories: number }>(
        (a, b) => sb.from('story_counts_daily').select('spot_id, day, stories').gte('day', SINCE_DAY).order('spot_id').order('day').range(a, b),
      ),
    ]);

    const today = kstDay(new Date().toISOString());

    // 스팟 → 광고그룹 매핑
    const spotGroup = new Map<string, string>();
    for (const s of spots) {
      const ig = s.instagram_id ?? '';
      if (!ig) continue;
      for (const g of AD_GROUPS) if (g.match(ig)) spotGroup.set(s.id, g.key);
    }
    const spotById = new Map(spots.map((s) => [s.id, s]));

    // 사이트 전체 + 스팟별 일별 조회수 (뷰의 day는 이미 KST 일자)
    const siteDaily: Daily = {};
    const perSpotDaily = new Map<string, Daily>();
    let totalViews = 0;
    for (const r of viewDaily) {
      siteDaily[r.day] = (siteDaily[r.day] ?? 0) + r.views;
      totalViews += r.views;
      let m = perSpotDaily.get(r.spot_id);
      if (!m) { m = {}; perSpotDaily.set(r.spot_id, m); }
      m[r.day] = (m[r.day] ?? 0) + r.views;
    }

    // 스팟별 일별 스토리 수 (비교군 매칭용)
    const perSpotStory = new Map<string, Daily>();
    for (const r of storyDaily) {
      let m = perSpotStory.get(r.spot_id);
      if (!m) { m = {}; perSpotStory.set(r.spot_id, m); }
      m[r.day] = (m[r.day] ?? 0) + r.stories;
    }
    const storyCountIn = (spotId: string, d0: string, d1: string) => {
      const m = perSpotStory.get(spotId);
      if (!m) return 0;
      let sum = 0;
      for (let d = d0; d <= d1; d = addDays(d, 1)) sum += m[d] ?? 0;
      return sum;
    };

    const sumDaily = (ids: string[]): Daily => {
      const out: Daily = {};
      for (const id of ids) {
        const m = perSpotDaily.get(id);
        if (!m) continue;
        for (const [d, c] of Object.entries(m)) out[d] = (out[d] ?? 0) + c;
      }
      return out;
    };

    const groups = AD_GROUPS.map((g) => {
      const ids = spots.filter((s) => spotGroup.get(s.id) === g.key).map((s) => s.id);
      const b0 = addDays(g.adDate, -7);
      const b1 = addDays(g.adDate, -1);
      const a0 = g.adDate;
      const a1 = addDays(g.adDate, 6) <= today ? addDays(g.adDate, 6) : today;
      const daily = sumDaily(ids);
      const before = windowStats(daily, b0, b1);
      const after = windowStats(daily, a0, a1);
      const siteBefore = windowStats(siteDaily, b0, b1);
      const siteAfter = windowStats(siteDaily, a0, a1);

      // 비교군: 광고 안 한 가게 중, 같은 도시 + 분석 기간 스토리 업로드 수가
      // 그룹 지점당 평균과 가장 비슷한 가게들 (그룹 크기의 3배, 최소 5곳).
      const cities = new Set(ids.map((id) => spotById.get(id)?.city ?? null));
      const groupStoryAvg = ids.reduce((acc, id) => acc + storyCountIn(id, b0, a1), 0) / Math.max(1, ids.length);
      const candidates = spots
        .filter((s) => !spotGroup.has(s.id) && cities.has(s.city ?? null))
        .map((s) => ({ s, stories: storyCountIn(s.id, b0, a1) }))
        .filter((c) => c.stories > 0)
        .sort((x, y) =>
          Math.abs(x.stories - groupStoryAvg) - Math.abs(y.stories - groupStoryAvg) || y.stories - x.stories,
        )
        .slice(0, Math.max(5, ids.length * 3));
      const ctrlIds = candidates.map((c) => c.s.id);
      const ctrlDaily = sumDaily(ctrlIds);
      const ctrlBefore = windowStats(ctrlDaily, b0, b1);
      const ctrlAfter = windowStats(ctrlDaily, a0, a1);

      return {
        key: g.key,
        label: g.label,
        adDate: g.adDate,
        spotCount: ids.length,
        spotNames: ids.map((id) => spotById.get(id)?.name ?? '?'),
        daily,
        beforeAvg: before.avg,
        afterAvg: after.avg,
        afterDays: after.days,
        growthPct: pct(before.avg, after.avg),
        siteGrowthPct: pct(siteBefore.avg, siteAfter.avg),
        control: {
          spotCount: ctrlIds.length,
          names: candidates.map((c) => `${c.s.name}(업로드 ${c.stories})`),
          groupStoryAvg: Math.round(groupStoryAvg * 10) / 10,
          daily: ctrlDaily,
          beforeAvg: ctrlBefore.avg,
          afterAvg: ctrlAfter.avg,
          growthPct: pct(ctrlBefore.avg, ctrlAfter.avg),
        },
      };
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      sinceDay: SINCE_DAY,
      today,
      totalViews,
      siteDaily,
      groups,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'query failed' }, { status: 500 });
  }
}

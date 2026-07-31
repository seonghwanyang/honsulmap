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
const SINCE = '2026-06-25T00:00:00+09:00';
const SINCE_DAY = '2026-06-25';

// UTC timestamptz → KST 달력 일자
const kstDay = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

type Daily = Record<string, number>;
const bump = (m: Daily, k: string) => { m[k] = (m[k] ?? 0) + 1; };
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
  for (let from = 0; from <= 100_000; from += 1000) {
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
    const [spots, viewRows, storyRows] = await Promise.all([
      fetchAll<{ id: string; name: string; city: string | null; instagram_id: string | null }>(
        (a, b) => sb.from('spots').select('id, name, city, instagram_id').order('id').range(a, b),
      ),
      fetchAll<{ spot_id: string; created_at: string }>(
        (a, b) => sb.from('spot_views').select('spot_id, created_at').gte('created_at', SINCE).order('id').range(a, b),
      ),
      fetchAll<{ spot_id: string; posted_at: string }>(
        (a, b) => sb.from('stories').select('spot_id, posted_at').gte('posted_at', SINCE).order('id').range(a, b),
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

    // 일별 집계: 사이트 전체 + 스팟별 (비교군 계산에 스팟별이 필요)
    const siteDaily: Daily = {};
    const perSpotDaily = new Map<string, Daily>();
    for (const r of viewRows) {
      const day = kstDay(r.created_at);
      bump(siteDaily, day);
      let m = perSpotDaily.get(r.spot_id);
      if (!m) { m = {}; perSpotDaily.set(r.spot_id, m); }
      bump(m, day);
    }

    // 스팟별 스토리 업로드 일자 목록 (비교군 매칭용)
    const perSpotStoryDays = new Map<string, string[]>();
    for (const r of storyRows) {
      if (!r.spot_id) continue;
      let a = perSpotStoryDays.get(r.spot_id);
      if (!a) { a = []; perSpotStoryDays.set(r.spot_id, a); }
      a.push(kstDay(r.posted_at));
    }
    const storyCountIn = (spotId: string, d0: string, d1: string) =>
      (perSpotStoryDays.get(spotId) ?? []).filter((d) => d >= d0 && d <= d1).length;

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
      totalViews: viewRows.length,
      siteDaily,
      groups,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'query failed' }, { status: 500 });
  }
}

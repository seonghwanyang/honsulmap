// 구/시 단위 SEO 랜딩 — "마포구 혼술바", "수원 혼술바", "애월 게스트하우스" 류.
// 가게 5곳 이상인 구/시만 페이지 생성(미만은 도시 페이지 섹션 유지).
// 상권이 구 전체와 동일한 곳(광안리=수영구 등)은 상권명을 제목으로 쓴다.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { supabase } from '@/lib/supabase';
import { getRegionLabel, jsonLdScript } from '@/lib/utils';
import { CITIES } from '@/lib/types';
import type { City, Region, Spot } from '@/lib/types';
import {
  MIN_PAGE_SPOTS,
  assignArea,
  districtFromUrlSlug,
  districtToUrlSlug,
  pageAreasOf,
  spotTypeWord,
  titleAreaOf,
} from '@/lib/areas';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://honsulmap.com';

export const revalidate = 3600;

type DistrictSpot = Pick<
  Spot,
  'id' | 'name' | 'slug' | 'region' | 'category' | 'memo' | 'naver_rating' | 'vibe_tags' | 'lat' | 'lng'
>;

const VIBE_LABELS: Record<string, string> = { party: '파티', quiet: '조용·힐링' };

function cityLabelOf(city: string): string | null {
  return CITIES.find((c) => c.value === city)?.label ?? null;
}

const getDistrictSpots = cache(async (city: City, district: Region): Promise<DistrictSpot[]> => {
  const { data } = await supabase
    .from('spots')
    .select('id, name, slug, region, category, memo, naver_rating, vibe_tags, lat, lng')
    .eq('city', city)
    .eq('region', district)
    .order('naver_rating', { ascending: false, nullsFirst: false })
    .order('name');
  return (data || []) as DistrictSpot[];
});

// 형제 구 링크용 — 도시 내 구별 가게 수
const getCityRegionCounts = cache(async (city: City): Promise<Map<string, number>> => {
  const { data } = await supabase.from('spots').select('region').eq('city', city);
  const counts = new Map<string, number>();
  for (const row of data || []) counts.set(row.region, (counts.get(row.region) || 0) + 1);
  return counts;
});

function resolveDistrict(city: string, districtSlug: string) {
  const cityLabel = cityLabelOf(city);
  if (!cityLabel) return null;
  const district = districtFromUrlSlug(city as City, districtSlug);
  if (!district) return null;
  return { city: city as City, cityLabel, district };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; district: string }>;
}): Promise<Metadata> {
  const { city, district: districtSlug } = await params;
  const ctx = resolveDistrict(city, districtSlug);
  if (!ctx) return { title: '지역 정보', robots: { index: false, follow: false } };

  const spots = await getDistrictSpots(ctx.city, ctx.district);
  if (spots.length < MIN_PAGE_SPOTS)
    return { title: '지역 정보', robots: { index: false, follow: false } };

  const titleArea = titleAreaOf(ctx.city, ctx.district);
  const displayLabel = titleArea ? titleArea.label : getRegionLabel(ctx.district);
  const typeWord = spotTypeWord(spots);
  const title = `${displayLabel} ${typeWord} 실시간 지도`;
  const description = `${ctx.cityLabel} ${displayLabel} ${typeWord} ${spots.length}곳의 위치·분위기·실시간 현황 정리.`;
  return {
    title,
    description,
    alternates: { canonical: `/region/${city}/${districtSlug}` },
    openGraph: { title, description, url: `/region/${city}/${districtSlug}` },
  };
}

export default async function DistrictPage({
  params,
}: {
  params: Promise<{ city: string; district: string }>;
}) {
  const { city: cityParam, district: districtSlug } = await params;
  const ctx = resolveDistrict(cityParam, districtSlug);
  if (!ctx) notFound();
  const { city, cityLabel, district } = ctx;

  const [spots, regionCounts] = await Promise.all([
    getDistrictSpots(city, district),
    getCityRegionCounts(city),
  ]);
  if (spots.length < MIN_PAGE_SPOTS) notFound();

  const titleArea = titleAreaOf(city, district);
  const regionLabel = getRegionLabel(district);
  const displayLabel = titleArea ? titleArea.label : regionLabel;
  const typeWord = spotTypeWord(spots);

  // 상권(mode: page) 섹션 그룹핑 — 최근접 배정, 나머지는 "그 외"
  const pageAreas = pageAreasOf(city, district);
  const grouped = new Map<string, DistrictSpot[]>();
  const rest: DistrictSpot[] = [];
  for (const s of spots) {
    const area = assignArea(s);
    if (area && pageAreas.some((a) => a.slug === area.slug)) {
      const list = grouped.get(area.slug) || [];
      list.push(s);
      grouped.set(area.slug, list);
    } else {
      rest.push(s);
    }
  }
  const areaSections = pageAreas
    .map((a) => ({ area: a, list: grouped.get(a.slug) || [] }))
    .filter((g) => g.list.length > 0)
    .sort((a, b) => b.list.length - a.list.length);

  const siblings = [...regionCounts.entries()]
    .filter(([r, n]) => r !== district && n >= MIN_PAGE_SPOTS)
    .sort((a, b) => b[1] - a[1]);

  const aliasPhrase = titleArea ? ` ${titleArea.aliases.join('·')} 일대를 포함합니다.` : '';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '혼술맵', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: `${cityLabel} ${typeWord}`, item: `${SITE_URL}/region/${city}` },
          { '@type': 'ListItem', position: 3, name: `${displayLabel} ${typeWord}` },
        ],
      },
      {
        '@type': 'ItemList',
        name: `${displayLabel} ${typeWord} 목록`,
        numberOfItems: spots.length,
        itemListElement: [...areaSections.flatMap((g) => g.list), ...rest].map((s, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: s.name,
          url: `${SITE_URL}/spot/${encodeURIComponent(s.slug)}`,
        })),
      },
    ],
  };

  const renderSpots = (list: DistrictSpot[]) => (
    <ul className="space-y-3">
      {list.map((s) => {
        const vibes = (s.vibe_tags || []).map((t) => VIBE_LABELS[t]).filter(Boolean);
        return (
          <li key={s.id}>
            <div className="flex items-baseline gap-2">
              <Link
                href={`/spot/${encodeURIComponent(s.slug)}`}
                className="font-semibold text-sm"
                style={{ color: '#111827', textDecoration: 'underline' }}
              >
                {s.name}
              </Link>
              {s.naver_rating != null && (
                <span className="text-xs" style={{ color: '#6b7280' }}>
                  ★ {Number(s.naver_rating).toFixed(1)}
                </span>
              )}
              {vibes.length > 0 && (
                <span className="text-xs" style={{ color: '#9ca3af' }}>
                  {vibes.join(' · ')}
                </span>
              )}
            </div>
            {s.memo && (
              <p className="text-xs mt-0.5" style={{ color: '#6b7280', lineHeight: 1.6 }}>
                {s.memo}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div style={{ background: '#ffffff', minHeight: '100dvh' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <header
        className="sticky top-0 z-20 flex items-center gap-3 px-4"
        style={{
          height: '52px',
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <Link
          href={`/region/${city}`}
          className="flex items-center gap-1 text-sm"
          style={{ color: '#6b7280' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {cityLabel}
        </Link>
        <span className="font-semibold text-sm" style={{ color: '#111827' }}>
          {displayLabel} {typeWord}
        </span>
      </header>

      <div className="px-4 pt-6 pb-24" style={{ maxWidth: 720, margin: '0 auto' }}>
        <nav className="text-xs mb-3" style={{ color: '#9ca3af' }} aria-label="현재 위치">
          <Link href="/" style={{ color: '#9ca3af' }}>혼술맵</Link>
          {' › '}
          <Link href={`/region/${city}`} style={{ color: '#9ca3af' }}>{cityLabel}</Link>
          {' › '}
          <span style={{ color: '#6b7280' }}>{displayLabel}</span>
        </nav>

        <h1 className="text-xl font-bold mb-1" style={{ color: '#111827' }}>
          {displayLabel} {typeWord} 실시간 지도
        </h1>
        <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>
          {cityLabel} {regionLabel} · {spots.length}곳 등록 · 실시간 현황 제공
        </p>

        <p className="text-sm mb-4" style={{ color: '#374151', lineHeight: 1.7 }}>
          {cityLabel} {displayLabel}에서 혼자 술 마시기 좋은 곳을 찾는다면, 혼술맵에 등록된{' '}
          {displayLabel} {typeWord} {spots.length}곳을 확인하세요.{aliasPhrase} 각 가게의
          실시간 현황을 모아 지금 어디가 활기찬지 한눈에 보여줍니다.
        </p>

        <Link
          href={`/?city=${city}&region=${district}`}
          className="inline-block text-sm font-semibold mb-8 px-4 py-2 rounded-lg"
          style={{ background: '#111827', color: '#ffffff' }}
        >
          지도에서 한눈에 보기
        </Link>

        {areaSections.map(({ area, list }) => (
          <section key={area.slug} className="mb-8">
            <h2 className="text-base font-bold mb-3" style={{ color: '#111827' }}>
              {list.length >= MIN_PAGE_SPOTS ? (
                <Link
                  href={`/region/${city}/${districtSlug}/${area.slug}`}
                  style={{ color: '#111827', textDecoration: 'underline' }}
                >
                  {area.label} {typeWord}
                </Link>
              ) : (
                <>{area.label} {typeWord}</>
              )}{' '}
              <span className="text-xs font-normal" style={{ color: '#9ca3af' }}>
                {list.length}곳
              </span>
            </h2>
            {renderSpots(list)}
          </section>
        ))}

        {rest.length > 0 && (
          <section className="mb-8">
            {areaSections.length > 0 && (
              <h2 className="text-base font-bold mb-3" style={{ color: '#111827' }}>
                그 외 {regionLabel}{' '}
                <span className="text-xs font-normal" style={{ color: '#9ca3af' }}>
                  {rest.length}곳
                </span>
              </h2>
            )}
            {renderSpots(rest)}
          </section>
        )}

        {siblings.length > 0 && (
          <section className="mt-10 pt-6" style={{ borderTop: '1px solid #f3f4f6' }}>
            <h2 className="text-sm font-bold mb-2" style={{ color: '#111827' }}>
              {cityLabel} 다른 동네
            </h2>
            <p className="text-xs" style={{ color: '#6b7280', lineHeight: 2 }}>
              {siblings.map(([r, n], i) => (
                <span key={r}>
                  {i > 0 && ' · '}
                  <Link
                    href={`/region/${city}/${districtToUrlSlug(city, r as Region)}`}
                    style={{ color: '#6b7280', textDecoration: 'underline' }}
                  >
                    {getRegionLabel(r)}
                  </Link>
                  <span style={{ color: '#d1d5db' }}> {n}</span>
                </span>
              ))}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}

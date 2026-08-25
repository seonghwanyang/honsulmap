// 상권 단위 SEO 랜딩 — "홍대 혼술바", "인계동 혼술바" 류.
// 상권은 행정구역이 아니라 좌표 최근접 배정(assignArea)으로 정의되며,
// 반경이 구 경계를 넘을 수 있어 도시 전체 가게에서 필터링한다.
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { supabase } from '@/lib/supabase';
import { getRegionLabel, jsonLdScript } from '@/lib/utils';
import { CITIES } from '@/lib/types';
import type { City, Spot } from '@/lib/types';
import {
  AREAS,
  MIN_PAGE_SPOTS,
  assignArea,
  districtFromUrlSlug,
  spotTypeWord,
  type Area,
} from '@/lib/areas';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://honsulmap.com';

export const revalidate = 3600;

type AreaSpot = Pick<
  Spot,
  'id' | 'name' | 'slug' | 'region' | 'category' | 'memo' | 'naver_rating' | 'vibe_tags' | 'lat' | 'lng'
>;

const VIBE_LABELS: Record<string, string> = { party: '파티', quiet: '조용·힐링' };

const getCitySpotsGeo = cache(async (city: City): Promise<AreaSpot[]> => {
  const { data } = await supabase
    .from('spots')
    .select('id, name, slug, region, category, memo, naver_rating, vibe_tags, lat, lng')
    .eq('city', city)
    .order('naver_rating', { ascending: false, nullsFirst: false })
    .order('name');
  return (data || []) as AreaSpot[];
});

function resolveArea(city: string, districtSlug: string, areaSlug: string): Area | null {
  if (!CITIES.some((c) => c.value === city)) return null;
  const district = districtFromUrlSlug(city as City, districtSlug);
  if (!district) return null;
  const area = AREAS.find(
    (a) => a.slug === areaSlug && a.city === city && a.district === district && a.mode === 'page',
  );
  return area ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string; district: string; area: string }>;
}): Promise<Metadata> {
  const { city, district, area: areaSlug } = await params;
  const area = resolveArea(city, district, areaSlug);
  if (!area) return { title: '지역 정보', robots: { index: false, follow: false } };

  const citySpots = await getCitySpotsGeo(area.city);
  const spots = citySpots.filter((s) => assignArea(s)?.slug === area.slug);
  if (spots.length < MIN_PAGE_SPOTS)
    return { title: '지역 정보', robots: { index: false, follow: false } };

  const typeWord = spotTypeWord(spots);
  const title = `${area.label} ${typeWord} 실시간 지도`;
  const description = `${area.label}(${area.aliases.join('·')}) ${typeWord} ${spots.length}곳 — 위치·분위기·인스타 실시간 스토리 현황.`;
  return {
    title,
    description,
    alternates: { canonical: `/region/${city}/${district}/${areaSlug}` },
    openGraph: { title, description, url: `/region/${city}/${district}/${areaSlug}` },
  };
}

export default async function AreaPage({
  params,
}: {
  params: Promise<{ city: string; district: string; area: string }>;
}) {
  const { city: cityParam, district: districtSlug, area: areaSlug } = await params;
  const area = resolveArea(cityParam, districtSlug, areaSlug);
  if (!area) notFound();

  const cityLabel = CITIES.find((c) => c.value === area.city)?.label ?? area.city;
  const districtLabelText = getRegionLabel(area.district);

  const citySpots = await getCitySpotsGeo(area.city);
  const spots = citySpots.filter((s) => assignArea(s)?.slug === area.slug);
  if (spots.length < MIN_PAGE_SPOTS) notFound();

  const typeWord = spotTypeWord(spots);

  // 같은 구의 형제 상권(전용 페이지만) — 실제 배정 수 기준으로 노출
  const siblingCounts = new Map<string, number>();
  for (const s of citySpots) {
    const a = assignArea(s);
    if (a) siblingCounts.set(a.slug, (siblingCounts.get(a.slug) || 0) + 1);
  }
  const siblings = AREAS.filter(
    (a) =>
      a.city === area.city &&
      a.district === area.district &&
      a.mode === 'page' &&
      a.slug !== area.slug &&
      (siblingCounts.get(a.slug) || 0) >= MIN_PAGE_SPOTS,
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '혼술맵', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: `${cityLabel} ${typeWord}`, item: `${SITE_URL}/region/${area.city}` },
          { '@type': 'ListItem', position: 3, name: `${districtLabelText} ${typeWord}`, item: `${SITE_URL}/region/${area.city}/${districtSlug}` },
          { '@type': 'ListItem', position: 4, name: `${area.label} ${typeWord}` },
        ],
      },
      {
        '@type': 'ItemList',
        name: `${area.label} ${typeWord} 목록`,
        numberOfItems: spots.length,
        itemListElement: spots.map((s, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: s.name,
          url: `${SITE_URL}/spot/${encodeURIComponent(s.slug)}`,
        })),
      },
    ],
  };

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
          href={`/region/${area.city}/${districtSlug}`}
          className="flex items-center gap-1 text-sm"
          style={{ color: '#6b7280' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {districtLabelText}
        </Link>
        <span className="font-semibold text-sm" style={{ color: '#111827' }}>
          {area.label} {typeWord}
        </span>
      </header>

      <div className="px-4 pt-6 pb-24" style={{ maxWidth: 720, margin: '0 auto' }}>
        <nav className="text-xs mb-3" style={{ color: '#9ca3af' }} aria-label="현재 위치">
          <Link href="/" style={{ color: '#9ca3af' }}>혼술맵</Link>
          {' › '}
          <Link href={`/region/${area.city}`} style={{ color: '#9ca3af' }}>{cityLabel}</Link>
          {' › '}
          <Link href={`/region/${area.city}/${districtSlug}`} style={{ color: '#9ca3af' }}>
            {districtLabelText}
          </Link>
          {' › '}
          <span style={{ color: '#6b7280' }}>{area.label}</span>
        </nav>

        <h1 className="text-xl font-bold mb-1" style={{ color: '#111827' }}>
          {area.label} {typeWord} 실시간 지도
        </h1>
        <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>
          {cityLabel} {districtLabelText} {area.label} · {spots.length}곳 등록 · 인스타 스토리 실시간 현황
        </p>

        <p className="text-sm mb-4" style={{ color: '#374151', lineHeight: 1.7 }}>
          {area.label}({area.aliases.join('·')}) 일대에서 혼자 술 마시기 좋은 곳을 찾는다면,{' '}
          {cityLabel} {districtLabelText} {area.label}의 {typeWord} {spots.length}곳을
          확인하세요. 각 가게의 공개 인스타그램 스토리를 모아 지금 어디가 활기찬지
          실시간으로 보여줍니다.
        </p>

        <Link
          href={`/?city=${area.city}&region=${area.district}`}
          className="inline-block text-sm font-semibold mb-8 px-4 py-2 rounded-lg"
          style={{ background: '#111827', color: '#ffffff' }}
        >
          지도에서 한눈에 보기
        </Link>

        <ul className="space-y-3">
          {spots.map((s) => {
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

        <section className="mt-10 pt-6" style={{ borderTop: '1px solid #f3f4f6' }}>
          <h2 className="text-sm font-bold mb-2" style={{ color: '#111827' }}>
            주변 지역 더 보기
          </h2>
          <p className="text-xs" style={{ color: '#6b7280', lineHeight: 2 }}>
            <Link
              href={`/region/${area.city}/${districtSlug}`}
              style={{ color: '#6b7280', textDecoration: 'underline' }}
            >
              {districtLabelText} 전체
            </Link>
            {siblings.map((a) => (
              <span key={a.slug}>
                {' · '}
                <Link
                  href={`/region/${a.city}/${districtSlug}/${a.slug}`}
                  style={{ color: '#6b7280', textDecoration: 'underline' }}
                >
                  {a.label}
                </Link>
              </span>
            ))}
            {' · '}
            <Link href={`/region/${area.city}`} style={{ color: '#6b7280', textDecoration: 'underline' }}>
              {cityLabel} 전체
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}

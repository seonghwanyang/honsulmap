// SEO 지역 랜딩 페이지 — "수원 혼술바", "제주 파티 게스트하우스" 류
// 리스트 인텐트 검색어를 받아주는 SSR 페이지. 도시별 전체 가게를
// 동네(region) 단위로 묶어 가시 텍스트로 렌더한다 (2026-08-25 SEO 감사 #2).
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { supabase } from '@/lib/supabase';
import { getRegionLabel, jsonLdScript } from '@/lib/utils';
import { CITIES } from '@/lib/types';
import type { City, Region, Spot } from '@/lib/types';
import { MIN_PAGE_SPOTS, districtToUrlSlug, spotTypeWord } from '@/lib/areas';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://honsulmap.com';

// 홈과 동일하게 1시간 ISR — 크롤러엔 신선하게, Supabase엔 부담 없게.
export const revalidate = 3600;

type RegionSpot = Pick<
  Spot,
  'id' | 'name' | 'slug' | 'region' | 'category' | 'memo' | 'naver_rating' | 'vibe_tags'
>;

const VIBE_LABELS: Record<string, string> = { party: '파티', quiet: '조용·힐링' };

function cityLabelOf(city: string): string | null {
  return CITIES.find((c) => c.value === city)?.label ?? null;
}

// generateMetadata와 페이지 본문이 같은 요청을 공유하도록 React cache로 감쌈.
const getCitySpots = cache(async (city: City): Promise<RegionSpot[]> => {
  const { data } = await supabase
    .from('spots')
    .select('id, name, slug, region, category, memo, naver_rating, vibe_tags')
    .eq('city', city)
    .order('naver_rating', { ascending: false, nullsFirst: false })
    .order('name');
  return (data || []) as RegionSpot[];
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const cityLabel = cityLabelOf(city);
  if (!cityLabel) return { title: '지역 정보', robots: { index: false, follow: false } };

  const spots = await getCitySpots(city as City);
  if (spots.length === 0) return { title: '지역 정보', robots: { index: false, follow: false } };

  const typeWord = spotTypeWord(spots);
  const title = `${cityLabel} ${typeWord} 실시간 지도`;
  const description = `${cityLabel} ${typeWord} ${spots.length}곳의 위치·분위기·실시간 현황을 동네별로 정리했습니다.`;
  return {
    title,
    description,
    alternates: { canonical: `/region/${city}` },
    openGraph: { title, description, url: `/region/${city}` },
  };
}

export default async function RegionPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  const cityLabel = cityLabelOf(city);
  if (!cityLabel) notFound();

  const spots = await getCitySpots(city as City);
  if (spots.length === 0) notFound();

  const typeWord = spotTypeWord(spots);
  const barCount = spots.filter((s) => s.category === 'bar').length;
  const ghCount = spots.length - barCount;
  const mixed = barCount > 0 && ghCount > 0;

  // 동네별 그룹 — 가게 수 많은 동네부터.
  const byRegion = new Map<string, RegionSpot[]>();
  for (const s of spots) {
    const list = byRegion.get(s.region) || [];
    list.push(s);
    byRegion.set(s.region, list);
  }
  const regionGroups = [...byRegion.entries()].sort((a, b) => b[1].length - a[1].length);

  const countPhrase = mixed
    ? `혼술바 ${barCount}곳과 파티 게스트하우스 ${ghCount}곳`
    : `${typeWord} ${spots.length}곳`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: '혼술맵', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: `${cityLabel} ${typeWord}` },
        ],
      },
      {
        '@type': 'ItemList',
        name: `${cityLabel} ${typeWord} 목록`,
        numberOfItems: spots.length,
        itemListElement: regionGroups.flatMap(([, list]) => list).map((s, i) => ({
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
          href="/"
          className="flex items-center gap-1 text-sm"
          style={{ color: '#6b7280' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          뒤로
        </Link>
        <span className="font-semibold text-sm" style={{ color: '#111827' }}>
          {cityLabel} {typeWord}
        </span>
      </header>

      <div className="px-4 pt-6 pb-24" style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1 className="text-xl font-bold mb-1" style={{ color: '#111827' }}>
          {cityLabel} {typeWord} 실시간 지도
        </h1>
        <p className="text-xs mb-4" style={{ color: '#9ca3af' }}>
          {regionGroups.length}개 동네 · {spots.length}곳 등록 · 실시간 현황 제공
        </p>

        <p className="text-sm mb-4" style={{ color: '#374151', lineHeight: 1.7 }}>
          {cityLabel}에서 혼자 술 마시기 좋은 곳을 찾는다면, 혼술맵에 등록된 {cityLabel}{' '}
          {countPhrase}을 동네별로 확인하세요. 혼술바는 혼자 온 손님끼리도 옆자리와
          자연스럽게 대화가 이어지는 공간입니다. 각 가게의 실시간 현황을 모아
          지금 어디가 활기찬지 한눈에 보여줍니다.
        </p>

        <Link
          href={`/?city=${city}`}
          className="inline-block text-sm font-semibold mb-8 px-4 py-2 rounded-lg"
          style={{ background: '#111827', color: '#ffffff' }}
        >
          지도에서 한눈에 보기
        </Link>

        {regionGroups.map(([region, list]) => (
          <section key={region} className="mb-8">
            <h2 className="text-base font-bold mb-3" style={{ color: '#111827' }}>
              {list.length >= MIN_PAGE_SPOTS ? (
                <Link
                  href={`/region/${city}/${districtToUrlSlug(city as City, region as Region)}`}
                  style={{ color: '#111827', textDecoration: 'underline' }}
                >
                  {getRegionLabel(region)}
                </Link>
              ) : (
                getRegionLabel(region)
              )}{' '}
              <span className="text-xs font-normal" style={{ color: '#9ca3af' }}>
                {list.length}곳
              </span>
            </h2>
            <ul className="space-y-3">
              {list.map((s) => {
                const vibes = (s.vibe_tags || [])
                  .map((t) => VIBE_LABELS[t])
                  .filter(Boolean);
                const sub = [
                  mixed ? (s.category === 'bar' ? '혼술바' : '게스트하우스') : null,
                  ...vibes,
                ].filter(Boolean);
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
                      {sub.length > 0 && (
                        <span className="text-xs" style={{ color: '#9ca3af' }}>
                          {sub.join(' · ')}
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
          </section>
        ))}

        <section className="mt-10 pt-6" style={{ borderTop: '1px solid #f3f4f6' }}>
          <h2 className="text-sm font-bold mb-2" style={{ color: '#111827' }}>
            다른 지역 혼술바
          </h2>
          <p className="text-xs" style={{ color: '#6b7280', lineHeight: 2 }}>
            {CITIES.filter((c) => c.value !== city).map((c, i) => (
              <span key={c.value}>
                {i > 0 && ' · '}
                <Link
                  href={`/region/${c.value}`}
                  style={{ color: '#6b7280', textDecoration: 'underline' }}
                >
                  {c.label}
                </Link>
              </span>
            ))}
          </p>
        </section>
      </div>
    </div>
  );
}

// Server-component shell — reads Vercel's IP geo headers to pick a
// default city for first-time visitors (Jeju residents land on Jeju,
// everyone else lands on Seoul), then hands off to the client map.
//
// URL `?city=` always overrides geo. Local dev (no Vercel headers)
// falls through to 'seoul'.
//
// Also renders a screen-reader-only spot list below the map so
// Googlebot indexes real Korean content (the map itself is fully
// client-rendered, so crawlers see zero spot names without this).
import { headers } from 'next/headers';
import MapClient from './MapClient';
import { supabase } from '@/lib/supabase';
import { getRegionLabel, getCategoryLabel } from '@/lib/utils';
import type { City, Spot } from '@/lib/types';

// KR-49 is the Jeju Special Self-Governing Province subdivision code
// in ISO 3166-2.
const JEJU_REGION_CODE = '49';

// Revalidate the SSR spot list once per hour — keeps Googlebot fed
// without hammering Supabase on every request.
export const revalidate = 3600;

async function detectInitialCity(): Promise<City> {
  const h = await headers();
  const country = h.get('x-vercel-ip-country') ?? '';
  const region = h.get('x-vercel-ip-country-region') ?? '';
  if (country === 'KR' && region === JEJU_REGION_CODE) return 'jeju';
  return 'seoul';
}

type SeoSpot = Pick<Spot, 'id' | 'name' | 'slug' | 'region' | 'category' | 'memo'>;

async function getSeoSpots(): Promise<SeoSpot[]> {
  const { data } = await supabase
    .from('spots')
    .select('id, name, slug, region, category, memo')
    .not('naver_rating', 'is', null)
    .order('naver_rating', { ascending: false })
    .limit(30);
  return (data || []) as SeoSpot[];
}

export default async function MapPage() {
  const [initialCity, spots] = await Promise.all([
    detectInitialCity(),
    getSeoSpots(),
  ]);
  return (
    <>
      <MapClient initialCity={initialCity} />
      <section aria-label="혼술맵 등록 가게 목록" className="sr-only">
        <h1>제주·서울 혼술바·게스트하우스 실시간 지도</h1>
        <p>
          제주와 서울의 혼술바, 게스트하우스를 인스타 스토리 기반 실시간 현황으로 모았습니다.
          홍대·강남·이태원·애월·서귀포 등 지금 핫한 곳을 지도에서 한눈에 확인하세요.
        </p>
        <ul>
          {spots.map((s) => (
            <li key={s.id}>
              <a href={`/spot/${s.slug}`}>
                <strong>{s.name}</strong> — {getRegionLabel(s.region)} · {getCategoryLabel(s.category)}
                {s.memo && <span>: {s.memo}</span>}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

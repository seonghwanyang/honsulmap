import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { Spot } from '@/lib/types';
import { getRegionLabel, jsonLdScript } from '@/lib/utils';
import SpotClient from './SpotClient';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://honsulmap.com';

// City-aware labels so Seoul/Busan spots don't get tagged "제주" in their
// title, description, and JSON-LD address. The region label itself comes
// from getRegionLabel (derived from the REGIONS source of truth).
const CITY_LABELS: Record<string, string> = {
  jeju: '제주', seoul: '서울', busan: '부산', incheon: '인천',
  daejeon: '대전', gwangju: '광주', daegu: '대구',
  gyeonggi: '경기', chungbuk: '충북', jeonbuk: '전북',
};

const CITY_ADDR_REGION: Record<string, string> = {
  jeju: '제주특별자치도', seoul: '서울특별시', busan: '부산광역시',
  incheon: '인천광역시', daejeon: '대전광역시', gwangju: '광주광역시',
  daegu: '대구광역시', gyeonggi: '경기도', chungbuk: '충청북도',
  jeonbuk: '전북특별자치도',
};

const CATEGORY_LABELS: Record<string, string> = {
  bar: '혼술바',
  guesthouse: '게스트하우스',
};

async function getSpot(slug: string): Promise<Spot | null> {
  const { data } = await supabase.from('spots').select('*').eq('slug', slug).maybeSingle();
  return (data as Spot) || null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const spot = await getSpot(slug);
  if (!spot) {
    return {
      title: '가게 정보',
      robots: { index: false, follow: false },
    };
  }

  const cityLabel = CITY_LABELS[spot.city] || '제주';
  const regionLabel = getRegionLabel(spot.region);
  const categoryLabel = CATEGORY_LABELS[spot.category] || '술집';
  const title = `${spot.name} - ${regionLabel} ${categoryLabel}`;
  const descBase = `${regionLabel}에 위치한 ${cityLabel} ${categoryLabel} ${spot.name}`;
  const address = spot.address ? ` · ${spot.address}` : '';
  const memo = spot.memo ? ` · ${spot.memo}` : '';
  const description = `${descBase}${address}${memo}. 인스타 실시간 스토리, 분위기 투표, 후기까지 제공하는 혼술맵.`.slice(0, 180);

  const image = spot.image_urls?.[0];

  // Thin-content guard: a spot with no Naver enrichment (rating/menus/
  // photos), no memo, and no hours is just a name+address shell. Keep those
  // out of the index so Google doesn't read the catalog as scaled thin
  // content — they reindex automatically once enriched. (AdSense "low value
  // content" mitigation.)
  const isThin =
    spot.naver_rating == null &&
    !spot.naver_menus?.length &&
    !spot.naver_photos?.length &&
    !spot.memo?.trim() &&
    !spot.business_hours?.trim();

  return {
    title,
    description,
    ...(isThin && { robots: { index: false, follow: true } }),
    keywords: [
      spot.name,
      `${spot.name} 위치`,
      `${spot.name} 후기`,
      `${regionLabel} 혼술`,
      `${regionLabel} 술집`,
      `${regionLabel} ${categoryLabel}`,
      `${cityLabel} 혼술`, `${cityLabel} 혼술바`, '혼술바', `${cityLabel} 술집 추천`,
    ],
    alternates: { canonical: `/spot/${slug}` },
    openGraph: {
      type: 'article',
      title,
      description,
      url: `${SITE_URL}/spot/${slug}`,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function SpotPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const spot = await getSpot(slug);

  const jsonLd = spot
    ? {
        '@context': 'https://schema.org',
        '@type': spot.category === 'guesthouse' ? 'LodgingBusiness' : 'BarOrPub',
        name: spot.name,
        url: `${SITE_URL}/spot/${slug}`,
        image: spot.image_urls || undefined,
        address: spot.address
          ? {
              '@type': 'PostalAddress',
              streetAddress: spot.address,
              addressRegion: CITY_ADDR_REGION[spot.city] || '제주특별자치도',
              addressCountry: 'KR',
            }
          : undefined,
        geo:
          spot.lat && spot.lng
            ? { '@type': 'GeoCoordinates', latitude: spot.lat, longitude: spot.lng }
            : undefined,
        telephone: spot.phone || undefined,
        openingHours: spot.business_hours || undefined,
        sameAs: spot.instagram_id ? [`https://www.instagram.com/${spot.instagram_id}/`] : undefined,
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
        />
      )}
      <SpotClient initialSpot={spot} />
    </>
  );
}

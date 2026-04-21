import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { Spot } from '@/lib/types';
import SpotClient from './SpotClient';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://honsulmap.com';

const REGION_LABELS: Record<string, string> = {
  jeju: '제주시',
  aewol: '애월',
  seogwipo: '서귀포',
  east: '제주 동부',
  west: '제주 서부',
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

  const regionLabel = REGION_LABELS[spot.region] || '제주';
  const categoryLabel = CATEGORY_LABELS[spot.category] || '술집';
  const title = `${spot.name} - ${regionLabel} ${categoryLabel}`;
  const descBase = `${regionLabel}에 위치한 제주 ${categoryLabel} ${spot.name}`;
  const address = spot.address ? ` · ${spot.address}` : '';
  const memo = spot.memo ? ` · ${spot.memo}` : '';
  const description = `${descBase}${address}${memo}. 인스타 실시간 스토리, 분위기 투표, 후기까지 제공하는 제주 혼술맵.`.slice(0, 180);

  const image = spot.image_urls?.[0];

  return {
    title,
    description,
    keywords: [
      spot.name,
      `${spot.name} 위치`,
      `${spot.name} 후기`,
      `${regionLabel} 혼술`,
      `${regionLabel} 술집`,
      `${regionLabel} ${categoryLabel}`,
      '제주 혼술', '제주도 혼술', '혼술바', '제주 술집 추천',
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
              addressRegion: '제주특별자치도',
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <SpotClient />
    </>
  );
}

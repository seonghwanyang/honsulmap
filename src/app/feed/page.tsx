import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { StoryWithSpot } from '@/lib/types';
import FeedClient from './FeedClient';

// Cache the rendered page (with its DB query) for 60s. Matches the cron
// cadence — users never see data older than 1 minute and the DB is hit
// at most once per minute per region filter.
export const revalidate = 60;

export const metadata: Metadata = {
  title: '전국 혼술바 실시간 피드',
  description:
    '전국 혼술바·게스트하우스의 실시간 현황을 한눈에. 홍대·강남·광안리·서면·애월·서귀포 등 지금 핫한 술집이 어디인지 피드로 확인.',
  alternates: { canonical: '/feed' },
  openGraph: {
    title: '전국 혼술바 실시간 피드 | 혼술맵',
    description: '전국 혼술바·게스트하우스의 실시간 현황 피드. 오늘 가장 핫한 술집.',
    url: '/feed',
  },
};

async function getStories(city: string, region: string): Promise<StoryWithSpot[]> {
  let query = supabase
    .from('stories')
    .select('*, spot:spots!inner(name, slug, city, region, category)')
    .order('posted_at', { ascending: false })
    .limit(50);
  if (city && city !== 'all') {
    query = query.eq('spot.city', city);
  }
  if (region && region !== 'all') {
    query = query.eq('spot.region', region);
  }
  const { data } = await query;
  return (data || []) as unknown as StoryWithSpot[];
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string; region?: string }>;
}) {
  const params = await searchParams;
  const city = params.city || 'all';
  const region = params.region || 'all';
  const stories = await getStories(city, region);
  return <FeedClient initialStories={stories} city={city} region={region} />;
}

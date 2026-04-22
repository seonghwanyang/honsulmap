import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { StoryWithSpot } from '@/lib/types';
import FeedClient from './FeedClient';

// Cache the rendered page (with its DB query) for 60s. Matches the cron
// cadence — users never see data older than 1 minute and the DB is hit
// at most once per minute per region filter.
export const revalidate = 60;

export const metadata: Metadata = {
  title: '제주 혼술바 실시간 피드',
  description:
    '제주도 애월·서귀포·구좌 혼술바의 인스타 스토리를 실시간으로. 지금 이 시간 어떤 제주 술집이 핫한지 피드로 확인하고 위치까지 바로 안내받으세요.',
  alternates: { canonical: '/feed' },
  openGraph: {
    title: '제주 혼술바 실시간 피드 | 혼술맵',
    description: '제주도 혼술바·게스트하우스의 인스타 스토리 실시간 피드. 오늘 가장 핫한 제주 술집.',
    url: '/feed',
  },
};

async function getStories(region: string): Promise<StoryWithSpot[]> {
  let query = supabase
    .from('stories')
    .select('*, spot:spots!inner(name, slug, region, category)')
    .order('posted_at', { ascending: false })
    .limit(50);
  if (region && region !== 'all') {
    query = query.eq('spot.region', region);
  }
  const { data } = await query;
  return (data || []) as unknown as StoryWithSpot[];
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ region?: string }>;
}) {
  const params = await searchParams;
  const region = params.region || 'all';
  const stories = await getStories(region);
  return <FeedClient initialStories={stories} region={region} />;
}

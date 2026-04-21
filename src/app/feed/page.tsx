import { supabase } from '@/lib/supabase';
import { StoryWithSpot } from '@/lib/types';
import FeedClient from './FeedClient';

export const dynamic = 'force-dynamic';

async function getStories(region: string): Promise<StoryWithSpot[]> {
  const now = new Date().toISOString();
  let query = supabase
    .from('stories')
    .select('*, spot:spots!inner(name, slug, region, category)')
    .gt('expires_at', now)
    .order('posted_at', { ascending: false });
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

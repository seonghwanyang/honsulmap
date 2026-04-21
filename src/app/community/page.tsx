import { supabase } from '@/lib/supabase';
import { Post, PostCategory } from '@/lib/types';
import CommunityClient from './CommunityClient';

export const dynamic = 'force-dynamic';

const LIMIT = 20;

async function getPosts(category: PostCategory | 'all'): Promise<Post[]> {
  let query = supabase
    .from('posts')
    .select(`
      id, spot_id, category, title, content, nickname, image_urls,
      like_count, comment_count, created_at,
      spot:spots (
        id, name, slug, region, category, address, lat, lng,
        instagram_id, like_count, mood_up, mood_down, image_urls, created_at
      )
    `)
    .order('created_at', { ascending: false })
    .range(0, LIMIT - 1);
  if (category !== 'all') query = query.eq('category', category);
  const { data } = await query;
  return (data || []) as unknown as Post[];
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const category = (params.category || 'all') as PostCategory | 'all';
  const posts = await getPosts(category);
  return <CommunityClient initialPosts={posts} category={category} />;
}

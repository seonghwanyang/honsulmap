import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { Post, PostCategory } from '@/lib/types';
import CommunityClient from './CommunityClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '제주 혼술 커뮤니티',
  description:
    '제주도 혼술바·게스트하우스 실시간 현황과 후기, 꿀팁을 나누는 커뮤니티. 제주 여행 혼술·게하 파티 정보 공유.',
  alternates: { canonical: '/community' },
  openGraph: {
    title: '제주 혼술 커뮤니티 | 혼술맵',
    description: '제주 혼술바 실시간 현황, 후기, 여행 꿀팁을 나누는 자유 커뮤니티.',
    url: '/community',
  },
};

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

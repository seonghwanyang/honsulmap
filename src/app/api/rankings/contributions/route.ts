import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  // Try contribution_rankings view first
  const { data: viewData, error: viewError } = await supabase
    .from('contribution_rankings')
    .select('*')
    .limit(50);

  if (!viewError && viewData) {
    return NextResponse.json(viewData);
  }

  // Fallback: direct query from posts table (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('posts')
    .select('nickname, category, like_count')
    .gte('created_at', thirtyDaysAgo);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Aggregate by nickname
  const rankMap = new Map<
    string,
    {
      nickname: string;
      post_count: number;
      status_count: number;
      review_count: number;
      total_likes: number;
      score: number;
    }
  >();

  for (const post of data || []) {
    const existing = rankMap.get(post.nickname) ?? {
      nickname: post.nickname,
      post_count: 0,
      status_count: 0,
      review_count: 0,
      total_likes: 0,
      score: 0,
    };

    existing.post_count += 1;
    if (post.category === 'status') existing.status_count += 1;
    if (post.category === 'review') existing.review_count += 1;
    existing.total_likes += post.like_count ?? 0;
    existing.score = existing.post_count * 10 + existing.total_likes * 2;

    rankMap.set(post.nickname, existing);
  }

  const rankings = Array.from(rankMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);

  return NextResponse.json(rankings);
}

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const url = new URL(request.url);
  const limitParam = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, MAX_LIMIT)
    : DEFAULT_LIMIT;

  const { data: spot, error } = await supabase
    .from('spots')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !spot) {
    return NextResponse.json({ error: '가게를 찾을 수 없습니다.' }, { status: 404 });
  }

  // Stories paginated. Initial paint gets the most-recent `limit` rows
  // plus an exact total so the client knows whether a "이전 스토리 더 보기"
  // button is worth rendering. Older batches load via
  // /api/spots/[slug]/stories?offset=N&limit=N.
  const { data: stories, count: story_total } = await supabase
    .from('stories')
    .select('*', { count: 'exact' })
    .eq('spot_id', spot.id)
    .order('posted_at', { ascending: false })
    .range(0, limit - 1);

  // Fetch comments for this spot
  const { data: comments } = await supabase
    .from('comments')
    .select('*')
    .eq('spot_id', spot.id)
    .order('created_at', { ascending: false });

  return NextResponse.json(
    {
      ...spot,
      stories: stories || [],
      story_total: story_total ?? 0,
      comments: comments || [],
    },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}

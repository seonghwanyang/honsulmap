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
  const offsetParam = Number(url.searchParams.get('offset'));
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, MAX_LIMIT)
    : DEFAULT_LIMIT;
  const offset = Number.isFinite(offsetParam) && offsetParam > 0
    ? offsetParam
    : 0;

  // Resolve slug -> spot id first so we can paginate + count stories
  // directly on the stories table (referencedTable ranges in the embedded
  // query were dropping unused but kept this two-step for clarity).
  const { data: spot, error: spotError } = await supabase
    .from('spots')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (spotError) {
    return NextResponse.json({ error: spotError.message }, { status: 500 });
  }
  if (!spot) {
    return NextResponse.json({ error: '가게를 찾을 수 없습니다.' }, { status: 404 });
  }

  const { data: stories, count, error: storiesError } = await supabase
    .from('stories')
    .select('*', { count: 'exact' })
    .eq('spot_id', spot.id)
    .order('posted_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (storiesError) {
    return NextResponse.json({ error: storiesError.message }, { status: 500 });
  }

  return NextResponse.json(
    { stories: stories || [], total: count ?? 0, offset, limit },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=180' } },
  );
}

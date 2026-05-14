import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Single embedded query: fetch spot + its stories in one Supabase round-trip
  // instead of two sequential queries (slug → id → stories).
  const { data, error } = await supabase
    .from('spots')
    .select('stories(*)')
    .eq('slug', slug)
    .order('posted_at', { referencedTable: 'stories', ascending: false })
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: '가게를 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json(data.stories || [], {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=180' },
  });
}

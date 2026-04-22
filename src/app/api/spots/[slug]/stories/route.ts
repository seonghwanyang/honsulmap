import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  // Look up spot by slug
  const { data: spot } = await supabase
    .from('spots')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!spot) {
    return NextResponse.json({ error: '가게를 찾을 수 없습니다.' }, { status: 404 });
  }

  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('spot_id', spot.id)
    .order('posted_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

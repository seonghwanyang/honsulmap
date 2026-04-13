import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const now = new Date().toISOString();

  const { data: spot, error } = await supabase
    .from('spots')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !spot) {
    return NextResponse.json({ error: '가게를 찾을 수 없습니다.' }, { status: 404 });
  }

  // Fetch active stories
  const { data: stories } = await supabase
    .from('stories')
    .select('*')
    .eq('spot_id', spot.id)
    .gt('expires_at', now)
    .order('posted_at', { ascending: false });

  // Fetch comments for this spot
  const { data: comments } = await supabase
    .from('comments')
    .select('*')
    .eq('spot_id', spot.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    ...spot,
    stories: stories || [],
    comments: comments || [],
  });
}

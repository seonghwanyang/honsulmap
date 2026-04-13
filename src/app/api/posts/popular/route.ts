import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') ?? '5', 10);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('posts')
    .select(`
      id,
      spot_id,
      category,
      title,
      content,
      nickname,
      image_urls,
      like_count,
      comment_count,
      created_at,
      spot:spots (
        id,
        name,
        slug,
        region,
        category,
        address,
        lat,
        lng,
        instagram_id,
        like_count,
        mood_up,
        mood_down,
        image_urls,
        created_at
      )
    `)
    .gte('created_at', sevenDaysAgo)
    .order('like_count', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

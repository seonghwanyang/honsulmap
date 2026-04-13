import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const body = await request.json();
  const { fingerprint } = body;

  if (!fingerprint) {
    return NextResponse.json({ error: 'fingerprint가 필요합니다.' }, { status: 400 });
  }

  // Look up spot by slug
  const { data: spot } = await supabase
    .from('spots')
    .select('id, like_count')
    .eq('slug', slug)
    .single();

  if (!spot) {
    return NextResponse.json({ error: '가게를 찾을 수 없습니다.' }, { status: 404 });
  }

  // Check if like already exists
  const { data: existing } = await supabase
    .from('likes')
    .select('id')
    .eq('target_type', 'spot')
    .eq('target_id', spot.id)
    .eq('fingerprint', fingerprint)
    .single();

  if (existing) {
    await supabase.from('likes').delete().eq('id', existing.id);
    await supabase
      .from('spots')
      .update({ like_count: Math.max(0, (spot.like_count ?? 1) - 1) })
      .eq('id', spot.id);
    return NextResponse.json({ liked: false });
  } else {
    const { error: insertError } = await supabase
      .from('likes')
      .insert([{ target_type: 'spot', target_id: spot.id, fingerprint }]);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await supabase
      .from('spots')
      .update({ like_count: (spot.like_count ?? 0) + 1 })
      .eq('id', spot.id);
    return NextResponse.json({ liked: true });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { fingerprint } = body;

  if (!fingerprint) {
    return NextResponse.json({ error: 'fingerprint가 필요합니다.' }, { status: 400 });
  }

  // Check if like already exists
  const { data: existing } = await supabase
    .from('likes')
    .select('id')
    .eq('target_type', 'comment')
    .eq('target_id', id)
    .eq('fingerprint', fingerprint)
    .single();

  if (existing) {
    // Remove like
    await supabase.from('likes').delete().eq('id', existing.id);

    // Decrement like_count
    const { data: comment } = await supabase
      .from('comments')
      .select('like_count')
      .eq('id', id)
      .single();

    if (comment) {
      await supabase
        .from('comments')
        .update({ like_count: Math.max(0, (comment.like_count ?? 1) - 1) })
        .eq('id', id);
    }

    return NextResponse.json({ liked: false });
  } else {
    // Add like
    const { error: insertError } = await supabase
      .from('likes')
      .insert([{ target_type: 'comment', target_id: id, fingerprint }]);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Increment like_count
    const { data: comment } = await supabase
      .from('comments')
      .select('like_count')
      .eq('id', id)
      .single();

    if (comment) {
      await supabase
        .from('comments')
        .update({ like_count: (comment.like_count ?? 0) + 1 })
        .eq('id', id);
    }

    return NextResponse.json({ liked: true });
  }
}

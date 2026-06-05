import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Post like toggle. This route was missing entirely — the post LikeButton
// POSTed to /api/posts/<id>/like which 404'd, so post likes never worked.
// Service-role so the posts.like_count UPDATE isn't RLS-denied.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { fingerprint } = body as { fingerprint?: string };
  if (!fingerprint) {
    return NextResponse.json({ error: 'fingerprint가 필요합니다.' }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: existing } = await sb
    .from('likes')
    .select('id')
    .eq('target_type', 'post')
    .eq('target_id', id)
    .eq('fingerprint', fingerprint)
    .maybeSingle();

  if (existing) {
    await sb.from('likes').delete().eq('id', existing.id);
    const { data: p } = await sb.from('posts').select('like_count').eq('id', id).single();
    if (p) {
      await sb
        .from('posts')
        .update({ like_count: Math.max(0, (p.like_count ?? 1) - 1) })
        .eq('id', id);
    }
    return NextResponse.json({ liked: false });
  }

  const { error: insertError } = await sb
    .from('likes')
    .insert([{ target_type: 'post', target_id: id, fingerprint }]);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }
  const { data: p } = await sb.from('posts').select('like_count').eq('id', id).single();
  if (p) {
    await sb
      .from('posts')
      .update({ like_count: (p.like_count ?? 0) + 1 })
      .eq('id', id);
  }
  return NextResponse.json({ liked: true });
}

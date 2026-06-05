import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Service-role: the like row inserts fine via anon, but the spots.like_count
// UPDATE is RLS-denied for anon, so the count never persisted (looked broken
// on reload). Server route → service role updates the count too.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = await request.json().catch(() => ({}));
  const { fingerprint } = body as { fingerprint?: string };

  if (!fingerprint) {
    return NextResponse.json({ error: 'fingerprint가 필요합니다.' }, { status: 400 });
  }

  const sb = supabaseAdmin();

  const { data: spot } = await sb
    .from('spots')
    .select('id, like_count')
    .eq('slug', slug)
    .single();
  if (!spot) {
    return NextResponse.json({ error: '가게를 찾을 수 없습니다.' }, { status: 404 });
  }

  const { data: existing } = await sb
    .from('likes')
    .select('id')
    .eq('target_type', 'spot')
    .eq('target_id', spot.id)
    .eq('fingerprint', fingerprint)
    .maybeSingle();

  if (existing) {
    await sb.from('likes').delete().eq('id', existing.id);
    await sb
      .from('spots')
      .update({ like_count: Math.max(0, (spot.like_count ?? 1) - 1) })
      .eq('id', spot.id);
    return NextResponse.json({ liked: false });
  }

  const { error: insertError } = await sb
    .from('likes')
    .insert([{ target_type: 'spot', target_id: spot.id, fingerprint }]);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }
  await sb
    .from('spots')
    .update({ like_count: (spot.like_count ?? 0) + 1 })
    .eq('id', spot.id);
  return NextResponse.json({ liked: true });
}

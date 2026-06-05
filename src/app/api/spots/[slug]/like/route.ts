import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Spot like toggle. Authoritative count (delete-all on unlike → self-heals
// duplicates, insert-one on like, recount from the table). Service-role so
// the spots.like_count UPDATE isn't RLS-denied.
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
  const { data: spot } = await sb.from('spots').select('id').eq('slug', slug).single();
  if (!spot) {
    return NextResponse.json({ error: '가게를 찾을 수 없습니다.' }, { status: 404 });
  }

  const { data: existing } = await sb
    .from('likes')
    .select('id')
    .eq('target_type', 'spot')
    .eq('target_id', spot.id)
    .eq('fingerprint', fingerprint);
  const has = (existing?.length ?? 0) > 0;

  if (has) {
    await sb
      .from('likes')
      .delete()
      .eq('target_type', 'spot')
      .eq('target_id', spot.id)
      .eq('fingerprint', fingerprint);
  } else {
    const { error } = await sb
      .from('likes')
      .insert([{ target_type: 'spot', target_id: spot.id, fingerprint }]);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { count } = await sb
    .from('likes')
    .select('id', { count: 'exact', head: true })
    .eq('target_type', 'spot')
    .eq('target_id', spot.id);
  const total = count ?? 0;
  await sb.from('spots').update({ like_count: total }).eq('id', spot.id);

  return NextResponse.json({ liked: !has, count: total });
}

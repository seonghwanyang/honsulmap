import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Comment like toggle. Same authoritative pattern as posts: delete-all on
// unlike (self-heals duplicates), insert-one on like, recount from the
// table. Service-role so the comments.like_count UPDATE isn't RLS-denied.
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
    .eq('target_type', 'comment')
    .eq('target_id', id)
    .eq('fingerprint', fingerprint);
  const has = (existing?.length ?? 0) > 0;

  if (has) {
    await sb
      .from('likes')
      .delete()
      .eq('target_type', 'comment')
      .eq('target_id', id)
      .eq('fingerprint', fingerprint);
  } else {
    const { error } = await sb
      .from('likes')
      .insert([{ target_type: 'comment', target_id: id, fingerprint }]);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const { count } = await sb
    .from('likes')
    .select('id', { count: 'exact', head: true })
    .eq('target_type', 'comment')
    .eq('target_id', id);
  const total = count ?? 0;
  await sb.from('comments').update({ like_count: total }).eq('id', id);

  return NextResponse.json({ liked: !has, count: total });
}

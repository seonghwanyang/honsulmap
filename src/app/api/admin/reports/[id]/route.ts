import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const VALID_STATUSES = ['pending', 'resolved', 'dismissed'] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = typeof body.status === 'string' ? body.status : '';
  const resolver_note =
    typeof body.resolver_note === 'string' ? body.resolver_note.trim() || null : null;
  const deleteTarget = body.delete_target === true;

  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number]))
    return NextResponse.json({ error: '상태가 올바르지 않습니다.' }, { status: 400 });

  const db = supabaseAdmin();

  // Fetch the report first so we know which target to delete (if requested).
  const { data: report, error: fetchErr } = await db
    .from('reports')
    .select('target_type, target_id')
    .eq('id', id)
    .single();
  if (fetchErr || !report)
    return NextResponse.json({ error: '신고를 찾을 수 없습니다.' }, { status: 404 });

  if (deleteTarget && status === 'resolved') {
    const table = report.target_type === 'post' ? 'posts' : 'comments';
    const { error: delErr } = await db.from(table).delete().eq('id', report.target_id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  const { data, error } = await db
    .from('reports')
    .update({
      status,
      resolver_note,
      resolved_at: status === 'pending' ? null : new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const VALID_STATUSES = ['pending', 'approved', 'rejected'] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = typeof body.status === 'string' ? body.status : '';
  const reviewer_note =
    typeof body.reviewer_note === 'string' ? body.reviewer_note.trim() : null;
  const created_spot_id =
    typeof body.created_spot_id === 'string' ? body.created_spot_id : null;

  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number]))
    return NextResponse.json({ error: '상태가 올바르지 않습니다.' }, { status: 400 });

  const patch: Record<string, unknown> = {
    status,
    reviewer_note,
    reviewed_at: status === 'pending' ? null : new Date().toISOString(),
  };
  if (created_spot_id) patch.created_spot_id = created_spot_id;

  const { data, error } = await supabaseAdmin()
    .from('spot_requests')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { error } = await supabaseAdmin().from('spot_requests').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

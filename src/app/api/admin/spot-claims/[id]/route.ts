import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const VALID = ['approved', 'rejected'] as const;

// Approve → grant the claimant membership of the spot (this is what actually
// "registers" them as the owner/manager) and mark the claim approved.
// Reject → just mark it rejected. Behind admin basic-auth (middleware).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = typeof body.status === 'string' ? body.status : '';
  const reviewer_note = typeof body.reviewer_note === 'string' ? body.reviewer_note.trim() : null;
  if (!VALID.includes(status as (typeof VALID)[number]))
    return NextResponse.json({ error: '상태가 올바르지 않습니다.' }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: claim } = await admin
    .from('spot_claims')
    .select('id, spot_id, user_id, role')
    .eq('id', id)
    .maybeSingle();
  if (!claim) return NextResponse.json({ error: '신청을 찾을 수 없습니다.' }, { status: 404 });

  if (status === 'approved') {
    // Idempotent on the (spot_id, user_id) primary key — re-approving or a
    // second manager claim won't error.
    const { error: memErr } = await admin
      .from('spot_members')
      .upsert(
        { spot_id: claim.spot_id, user_id: claim.user_id, role: claim.role },
        { onConflict: 'spot_id,user_id' },
      );
    if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });
  }

  const { data, error } = await admin
    .from('spot_claims')
    .update({ status, reviewer_note, reviewed_at: new Date().toISOString() })
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
  const { error } = await supabaseAdmin().from('spot_claims').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { assertAdmin } from '@/lib/adminAuth';
import { genClaimCode } from '@/lib/claimCode';

const VALID = ['approved', 'rejected'] as const;

// Approve → grant the claimant membership of the spot (this is what actually
// "registers" them as the owner/manager) and mark the claim approved.
// Reject → just mark it rejected. Behind admin basic-auth (middleware).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const admin = supabaseAdmin();

  // Issue / reissue the one-time DM verification code. For claims created before
  // the code feature existed (code is null) or to rotate one. Pending only.
  if (body.issue_code === true) {
    const { data: claim } = await admin
      .from('spot_claims')
      .select('id, status')
      .eq('id', id)
      .maybeSingle();
    if (!claim) return NextResponse.json({ error: '신청을 찾을 수 없습니다.' }, { status: 404 });
    if (claim.status !== 'pending')
      return NextResponse.json({ error: '대기 중인 신청에만 코드를 발급할 수 있어요.' }, { status: 400 });
    const { data, error } = await admin
      .from('spot_claims')
      .update({ verification_code: genClaimCode() })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  const status = typeof body.status === 'string' ? body.status : '';
  const reviewer_note = typeof body.reviewer_note === 'string' ? body.reviewer_note.trim() : null;
  if (!VALID.includes(status as (typeof VALID)[number]))
    return NextResponse.json({ error: '상태가 올바르지 않습니다.' }, { status: 400 });
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
  } else if (status === 'rejected') {
    // Revoke: ensure the claimant holds no membership for this spot. Covers
    // both rejecting a pending claim (no-op) and revoking an approved owner.
    const { error: memErr } = await admin
      .from('spot_members')
      .delete()
      .eq('spot_id', claim.spot_id)
      .eq('user_id', claim.user_id);
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const admin = supabaseAdmin();
  // If the claim was approved, drop the membership it granted too — deleting
  // only the record would otherwise leave the owner with orphaned access.
  const { data: claim } = await admin
    .from('spot_claims')
    .select('spot_id, user_id, status')
    .eq('id', id)
    .maybeSingle();
  if (claim?.status === 'approved') {
    await admin
      .from('spot_members')
      .delete()
      .eq('spot_id', claim.spot_id)
      .eq('user_id', claim.user_id);
  }
  const { error } = await admin.from('spot_claims').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

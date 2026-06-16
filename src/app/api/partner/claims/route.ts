import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { genClaimCode } from '@/lib/claimCode';

// Submit an ownership claim. Identity is taken from the session (never the
// client body), and we block claiming a spot you already own or already have a
// pending claim for. Approval (→ creates the spot_members row) happens in the
// admin endpoint, not here.
export async function POST(request: NextRequest) {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const spot_id = typeof body.spot_id === 'string' ? body.spot_id : '';
  const evidence = typeof body.evidence === 'string' ? body.evidence.trim().slice(0, 500) : '';
  const role = body.role === 'manager' ? 'manager' : 'owner';
  if (!spot_id) return NextResponse.json({ error: '가게를 선택해주세요.' }, { status: 400 });

  const admin = supabaseAdmin();

  const { data: spot } = await admin.from('spots').select('id').eq('id', spot_id).maybeSingle();
  if (!spot) return NextResponse.json({ error: '존재하지 않는 가게입니다.' }, { status: 400 });

  const { data: member } = await admin
    .from('spot_members')
    .select('spot_id')
    .eq('spot_id', spot_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (member) return NextResponse.json({ error: '이미 등록된 가게예요.' }, { status: 409 });

  const { data: dup } = await admin
    .from('spot_claims')
    .select('id')
    .eq('spot_id', spot_id)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();
  if (dup) return NextResponse.json({ error: '이미 심사 중인 신청이 있어요.' }, { status: 409 });

  const verification_code = genClaimCode();
  const { error } = await admin
    .from('spot_claims')
    .insert({ spot_id, user_id: user.id, role, evidence: evidence || null, verification_code });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, code: verification_code }, { status: 201 });
}

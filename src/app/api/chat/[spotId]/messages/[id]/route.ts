import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

// 채팅 메시지 삭제(#6 운영) — 사장님(spot_members)은 모든 메시지, 일반 유저는
// 자기 메시지만. 소프트삭제(is_deleted=true)라 GET 목록에서 자동 제외되고,
// Realtime UPDATE 이벤트로 다른 참여자 화면에서도 즉시 사라진다.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ spotId: string; id: string }> },
) {
  const { spotId, id } = await params;
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const admin = supabaseAdmin();
  const [{ data: member }, { data: msg }] = await Promise.all([
    admin.from('spot_members').select('role').eq('spot_id', spotId).eq('user_id', user.id).maybeSingle(),
    admin.from('chat_messages').select('user_id').eq('id', id).eq('spot_id', spotId).maybeSingle(),
  ]);
  if (!msg) return NextResponse.json({ ok: true }); // 이미 삭제/없음 — 멱등
  if (!member && msg.user_id !== user.id)
    return NextResponse.json({ error: '내가 쓴 메시지만 삭제할 수 있어요.' }, { status: 403 });

  const { error } = await admin
    .from('chat_messages')
    .update({ is_deleted: true })
    .eq('id', id)
    .eq('spot_id', spotId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

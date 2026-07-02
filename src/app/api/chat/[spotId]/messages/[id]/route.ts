import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

// 채팅 메시지 삭제(#6 운영) — 사장님(spot_members)만. 소프트삭제(is_deleted=true)라
// GET 목록에서 자동 제외된다. 신고는 누구나(별도: /api/reports).
async function requireMember(spotId: string) {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user)
    return { error: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) } as const;

  const admin = supabaseAdmin();
  const { data: member } = await admin
    .from('spot_members')
    .select('role')
    .eq('spot_id', spotId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member)
    return { error: NextResponse.json({ error: '삭제 권한이 없어요.' }, { status: 403 }) } as const;

  return { admin } as const;
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ spotId: string; id: string }> },
) {
  const { spotId, id } = await params;
  const ctx = await requireMember(spotId);
  if ('error' in ctx) return ctx.error;

  const { error } = await ctx.admin
    .from('chat_messages')
    .update({ is_deleted: true })
    .eq('id', id)
    .eq('spot_id', spotId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

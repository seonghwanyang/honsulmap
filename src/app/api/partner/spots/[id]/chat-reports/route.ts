import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { chatNick } from '@/lib/chatNick';

// 내 가게 채팅의 '대기중' 신고 목록(#6 운영). 사장님(spot_members)만.
// reports(target_type=chat_message) 중 이 가게 메시지만 필터해서 내려준다.
async function requireMember(id: string) {
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
    .eq('spot_id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member)
    return { error: NextResponse.json({ error: '권한이 없어요.' }, { status: 403 }) } as const;

  return { admin } as const;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMember(id);
  if ('error' in ctx) return ctx.error;
  const { admin } = ctx;

  const { data: reps } = await admin
    .from('reports')
    .select('id, target_id, reason, detail, created_at')
    .eq('target_type', 'chat_message')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50);

  const ids = [...new Set((reps ?? []).map((r) => r.target_id as string))];
  const msgMap = new Map<string, { body: string; user_id: string; is_deleted: boolean }>();
  if (ids.length) {
    const { data: msgs } = await admin
      .from('chat_messages')
      .select('id, body, user_id, is_deleted')
      .in('id', ids)
      .eq('spot_id', id);
    for (const m of (msgs ?? []) as { id: string; body: string; user_id: string; is_deleted: boolean }[]) {
      msgMap.set(m.id, { body: m.body, user_id: m.user_id, is_deleted: m.is_deleted });
    }
  }

  const reports = (reps ?? [])
    .filter((r) => msgMap.has(r.target_id as string))
    .map((r) => {
      const m = msgMap.get(r.target_id as string)!;
      return {
        id: r.id,
        message_id: r.target_id,
        reason: r.reason,
        detail: r.detail,
        created_at: r.created_at,
        body: m.is_deleted ? null : m.body,
        nickname: chatNick(m.user_id),
        deleted: m.is_deleted,
      };
    });

  return NextResponse.json({ reports });
}

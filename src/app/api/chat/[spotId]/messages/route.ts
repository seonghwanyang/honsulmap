import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { chatNick, chatAvatar } from '@/lib/chatNick';
import type { ChatMessage } from '@/lib/types';

// 가게별 채팅방(#6) — 메시지. 설계: docs/chat-design.md (체크포인트 ③).
//   GET  open 방의 최근 메시지(삭제분 제외). 표시명·프사는 서버가 해석해 내려줌.
//   POST 메시지 전송(로그인 필수, open + 미차단 + 길이검증 + 레이트리밋).
//
// 표시명/프사는 chat_messages에 저장하지 않는다(설계 §2.2). 카톡/구글 실명·프로필
// 노출을 막기 위해 user_id에서 익명 닉(chatNick)+동물 프사(chatAvatar)를 결정적으로
// 만들어 응답에 실어 보낸다. (나중에 /me에서 바꾼 값은 여기서 덮어쓸 자리.)

const PAGE = 50;
const MAX_LEN = 1000;

type Row = {
  id: string;
  spot_id: string;
  user_id: string;
  body: string;
  is_deleted: boolean;
  created_at: string;
};

type Profile = { nickname: string | null; avatar_url: string | null };

// user_id 집합 → 직접 정한 프로필(없으면 기본값 사용). 서비스롤이라 RLS 무관.
async function loadProfiles(
  admin: ReturnType<typeof supabaseAdmin>,
  userIds: string[],
): Promise<Map<string, Profile>> {
  const out = new Map<string, Profile>();
  if (userIds.length === 0) return out;
  const { data } = await admin
    .from('user_profiles')
    .select('user_id, nickname, avatar_url')
    .in('user_id', userIds);
  for (const p of (data ?? []) as ({ user_id: string } & Profile)[]) {
    out.set(p.user_id, { nickname: p.nickname, avatar_url: p.avatar_url });
  }
  return out;
}

// 직접 정한 닉/프사가 있으면 그것을, 없으면 기본 동물닉/이모지를 표시값으로.
function resolveIdentity(
  userId: string,
  profile: Profile | undefined,
): { name: string; avatar: ChatMessage['avatar'] } {
  const name = profile?.nickname?.trim() || chatNick(userId);
  const avatar = profile?.avatar_url ? { url: profile.avatar_url } : chatAvatar(userId);
  return { name, avatar };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ spotId: string }> }) {
  const { spotId } = await params;
  const { searchParams } = new URL(request.url);
  const before = searchParams.get('before'); // created_at ISO, 과거 페이지네이션

  const admin = supabaseAdmin();
  const { data: room } = await admin
    .from('chat_rooms')
    .select('spot_id, is_open, opened_by')
    .eq('spot_id', spotId)
    .maybeSingle<{ spot_id: string; is_open: boolean; opened_by: string }>();
  // 미개설/닫힘이면 메시지 없음 — 클라가 빈 상태 멘트로 분기.
  if (!room || !room.is_open) return NextResponse.json({ messages: [] });

  let q = admin
    .from('chat_messages')
    .select('id, spot_id, user_id, body, is_deleted, created_at')
    .eq('spot_id', spotId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .limit(PAGE);
  if (before) q = q.lt('created_at', before);

  const { data: rows, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const list = (rows ?? []) as Row[];
  const profiles = await loadProfiles(admin, [...new Set(list.map((r) => r.user_id))]);

  // 최신순으로 받아 오래된→최신으로 뒤집어 렌더.
  const messages: ChatMessage[] = list
    .map((r) => ({
      id: r.id,
      user_id: r.user_id,
      body: r.body,
      created_at: r.created_at,
      ...resolveIdentity(r.user_id, profiles.get(r.user_id)),
      is_owner: r.user_id === room.opened_by,
    }))
    .reverse();

  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ spotId: string }> }) {
  const { spotId } = await params;

  // 전송은 로그인 필수.
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  if (!(await rateLimit('chat:send', clientIp(request), 60, 20))) {
    return NextResponse.json(
      { error: '메시지를 너무 빨리 보내고 있어요. 잠시만요.' },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!text || text.length > MAX_LEN) {
    return NextResponse.json({ error: `메시지를 1~${MAX_LEN}자로 입력해주세요.` }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { data: room } = await admin
    .from('chat_rooms')
    .select('spot_id, is_open, opened_by')
    .eq('spot_id', spotId)
    .maybeSingle<{ spot_id: string; is_open: boolean; opened_by: string }>();
  if (!room || !room.is_open) {
    return NextResponse.json({ error: '채팅방이 열려 있지 않아요.' }, { status: 409 });
  }

  // 차단 확인(설계: 차단 유저는 전송 거부). chat_bans는 서비스롤만 읽음.
  const { data: ban } = await admin
    .from('chat_bans')
    .select('user_id')
    .eq('spot_id', spotId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (ban) {
    return NextResponse.json({ error: '이 채팅방에 메시지를 보낼 수 없어요.' }, { status: 403 });
  }

  const { data: inserted, error } = await admin
    .from('chat_messages')
    .insert({ spot_id: spotId, user_id: user.id, body: text })
    .select('id, spot_id, user_id, body, is_deleted, created_at')
    .single<Row>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: prof } = await admin
    .from('user_profiles')
    .select('nickname, avatar_url')
    .eq('user_id', user.id)
    .maybeSingle<Profile>();

  const message: ChatMessage = {
    id: inserted.id,
    user_id: inserted.user_id,
    body: inserted.body,
    created_at: inserted.created_at,
    ...resolveIdentity(inserted.user_id, prof ?? undefined),
    is_owner: inserted.user_id === room.opened_by,
  };
  return NextResponse.json({ message }, { status: 201 });
}

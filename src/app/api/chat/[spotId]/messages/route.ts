import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import type { ChatMessage } from '@/lib/types';

// 가게별 채팅방(#6) — 메시지. 설계: docs/chat-design.md (체크포인트 ③).
//   GET  open 방의 최근 메시지(삭제분 제외). 표시명은 서버가 해석해 내려줌.
//   POST 메시지 전송(로그인 필수, open + 미차단 + 길이검증 + 레이트리밋).
//
// 표시명은 chat_messages에 비정규화 저장하지 않는다(설계 §2.2). 작성자 이름은
// auth metadata에서 해석 — 서비스롤(auth.admin)만 읽을 수 있으므로 여기서 해석해
// 응답에 실어 보낸다. (Realtime로 도착하는 메시지의 이름도 클라가 이 GET으로 보강.)

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

// auth metadata에서 표시명 (두 제품 결정 중 #1).
function nameFromMeta(meta: Record<string, unknown> | undefined): string {
  const name = meta?.name;
  const full = meta?.full_name;
  if (typeof name === 'string' && name.trim()) return name.trim();
  if (typeof full === 'string' && full.trim()) return full.trim();
  return '익명';
}

// user_id 집합 → { id: 표시명 }. getUserById를 유니크 id마다 1회(작은 N).
async function resolveNames(
  admin: ReturnType<typeof supabaseAdmin>,
  userIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(userIds)];
  await Promise.all(
    unique.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      out.set(id, nameFromMeta(data.user?.user_metadata));
    }),
  );
  return out;
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
  const names = await resolveNames(admin, list.map((r) => r.user_id));

  // 최신순으로 받아 오래된→최신으로 뒤집어 렌더.
  const messages: ChatMessage[] = list
    .map((r) => ({
      id: r.id,
      user_id: r.user_id,
      body: r.body,
      created_at: r.created_at,
      name: names.get(r.user_id) ?? '익명',
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

  const message: ChatMessage = {
    id: inserted.id,
    user_id: inserted.user_id,
    body: inserted.body,
    created_at: inserted.created_at,
    name: nameFromMeta(user.user_metadata),
    is_owner: inserted.user_id === room.opened_by,
  };
  return NextResponse.json({ message }, { status: 201 });
}

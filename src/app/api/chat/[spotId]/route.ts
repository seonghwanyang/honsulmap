import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { rateLimit, clientIp } from '@/lib/rateLimit';

// 가게별 채팅방(#6) — 방 자체. 설계: docs/chat-design.md (체크포인트 ②).
//   GET   방 존재/open/공지 조회. 세션 선택(비로그인도 빈 상태 분기는 봐야 함).
//   POST  방 개설(인증 사장님). spot_members 게이트 → 서비스롤 upsert.
//   PATCH 닫기/재오픈/공지(인증 사장님). 같은 게이트.

// 사장님 게이트: 세션의 user가 이 가게 spot_members에 있어야 함.
// (partner/spots/[id] 라우트의 requireMember 패턴과 동일.)
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
    return { error: NextResponse.json({ error: '권한이 없는 가게예요.' }, { status: 403 }) } as const;

  return { admin, user, role: member.role as 'owner' | 'manager' } as const;
}

type Room = {
  spot_id: string;
  is_open: boolean;
  notice: string | null;
  opened_by: string;
  created_at: string;
  updated_at: string;
};

const ROOM_COLS = 'spot_id, is_open, notice, opened_by, created_at, updated_at';

// 방 조회. row 없으면 { room: null } (= 미개설). 누구나 호출 가능.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ spotId: string }> }) {
  const { spotId } = await params;
  const admin = supabaseAdmin();
  const { data: room } = await admin
    .from('chat_rooms')
    .select(ROOM_COLS)
    .eq('spot_id', spotId)
    .maybeSingle<Room>();

  return NextResponse.json({ room: room ?? null });
}

// 방 개설 — is_open=true, opened_by=현재 사장님. 이미 있으면 다시 열기.
export async function POST(request: NextRequest, { params }: { params: Promise<{ spotId: string }> }) {
  const { spotId } = await params;
  const ctx = await requireMember(spotId);
  if ('error' in ctx) return ctx.error;
  const { admin, user } = ctx;

  if (!(await rateLimit('chat:open', clientIp(request), 600, 5))) {
    return NextResponse.json(
      { error: '요청이 너무 잦아요. 잠시 후 다시 시도해주세요.' },
      { status: 429 },
    );
  }

  const { data: room, error } = await admin
    .from('chat_rooms')
    .upsert(
      { spot_id: spotId, is_open: true, opened_by: user.id, updated_at: new Date().toISOString() },
      { onConflict: 'spot_id' },
    )
    .select(ROOM_COLS)
    .single<Room>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ room }, { status: 201 });
}

// 방 닫기/재오픈/공지. 사장님만.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ spotId: string }> }) {
  const { spotId } = await params;
  const ctx = await requireMember(spotId);
  if ('error' in ctx) return ctx.error;
  const { admin } = ctx;

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.is_open === 'boolean') patch.is_open = body.is_open;
  if (typeof body.notice === 'string') patch.notice = body.notice.trim().slice(0, 200) || null;
  else if (body.notice === null) patch.notice = null;

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: '변경할 내용이 없습니다.' }, { status: 400 });
  patch.updated_at = new Date().toISOString();

  const { data: room, error } = await admin
    .from('chat_rooms')
    .update(patch)
    .eq('spot_id', spotId)
    .select(ROOM_COLS)
    .maybeSingle<Room>();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!room) return NextResponse.json({ error: '아직 개설되지 않은 방이에요.' }, { status: 404 });

  return NextResponse.json({ room });
}

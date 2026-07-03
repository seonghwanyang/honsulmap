import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

// 채팅 등에서 쓰는 표시 프로필(닉네임/프사) 조회·갱신. 본인 것만 (RLS self).
// 비우면 user_id 기반 기본 동물닉/이모지가 쓰인다(chatNick/chatAvatar).
// PUT은 두 필드를 함께 받는 '전체 교체' — /me 화면이 항상 둘 다 보낸다.

const MAX_NICK = 20;

export async function GET() {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data } = await sb
    .from('user_profiles')
    .select('nickname, avatar_url')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({ nickname: data?.nickname ?? null, avatar_url: data?.avatar_url ?? null });
}

export async function PUT(request: Request) {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));

  let nickname: string | null = null;
  if (typeof body?.nickname === 'string') {
    const t = body.nickname.trim();
    if (t.length > MAX_NICK) {
      return NextResponse.json({ error: `닉네임은 ${MAX_NICK}자 이내로 입력해주세요.` }, { status: 400 });
    }
    nickname = t || null;
  }

  let avatar_url: string | null = null;
  if (typeof body?.avatar_url === 'string' && body.avatar_url) {
    // 우리 avatars 버킷의 공개 URL만 허용(임의 외부 URL 차단).
    const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/`;
    if (!body.avatar_url.startsWith(prefix)) {
      return NextResponse.json({ error: '프사 이미지 주소가 올바르지 않아요.' }, { status: 400 });
    }
    avatar_url = body.avatar_url;
  }

  const { error } = await sb
    .from('user_profiles')
    .upsert(
      { user_id: user.id, nickname, avatar_url, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ nickname, avatar_url });
}

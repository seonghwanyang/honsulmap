import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createServerSupabase } from '@/lib/supabase/server';

// 앱(FCM)에서 받은 디바이스 푸시 토큰 저장. (PR-4)
// 토큰 단위 upsert. 로그인 상태면 user_id 연결(추후 타겟 푸시용), 비로그인도 허용.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = body?.token;
  const platform = body?.platform;
  if (!token || !platform) {
    return NextResponse.json({ error: 'token and platform required' }, { status: 400 });
  }

  let userId: string | null = null;
  try {
    const sb = await createServerSupabase();
    const { data } = await sb.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    // 세션 없음 — 익명 토큰으로 저장
  }

  const { error } = await supabaseAdmin()
    .from('device_tokens')
    .upsert(
      { token, platform, user_id: userId, updated_at: new Date().toISOString() },
      { onConflict: 'token' },
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

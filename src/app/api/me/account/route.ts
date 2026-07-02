import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

// 앱 내 계정 삭제 (App Store 5.1.1(v) 필수 — 이메일 요청 방식은 거부됨).
// 세션 유저 본인의 계정과 관련 데이터를 즉시 영구 삭제한다.
export async function DELETE() {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const uid = user.id;
  const admin = supabaseAdmin();

  // 사용자 데이터 정리 (best-effort — 없는 테이블/행은 무시).
  await Promise.allSettled([
    admin.from('favorites').delete().eq('user_id', uid),
    admin.from('user_profiles').delete().eq('user_id', uid),
    admin.from('marketing_consent').delete().eq('user_id', uid),
  ]);

  // 계정(auth) 삭제 — 핵심.
  const { error } = await admin.auth.admin.deleteUser(uid);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.auth.signOut().catch(() => {});
  return NextResponse.json({ ok: true });
}

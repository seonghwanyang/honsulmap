import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

// 사장 대시보드 공지 (playbook §1.6) — 로그인 유저에게 공지 목록.
// 배너는 클라가 첫 항목(최신 active)만, 아카이브는 전체를 그린다.
export async function GET() {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin()
    .from('partner_notices')
    .select('id, title, body, type, active, created_at')
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notices: data ?? [] });
}

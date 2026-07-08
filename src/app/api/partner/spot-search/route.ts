import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

// Spot lookup for the claim flow — owner searches their venue by name or IG
// handle. Login-gated (whole /partner area is). spots are public data, so the
// service role read is fine here.
export async function GET(request: NextRequest) {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const raw = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  // Strip characters that would break the PostgREST or()/ilike filter syntax.
  const q = raw.replace(/[,()%_*]/g, ' ').trim();

  // q 없이 부르면 전체 목록(가벼운 4필드)을 내려준다 — claim 페이지가 마운트 시
  // 1회 받아서 지도 검색창처럼 로컬 필터(타이핑마다 서버 왕복 없이 즉시).
  if (q.length < 1) {
    const { data } = await supabaseAdmin()
      .from('spots')
      .select('id, name, slug, region, instagram_id')
      .order('name')
      .limit(1000);
    return NextResponse.json({ spots: data ?? [] });
  }

  const { data } = await supabaseAdmin()
    .from('spots')
    .select('id, name, slug, region, instagram_id')
    .or(`name.ilike.%${q}%,instagram_id.ilike.%${q}%`)
    .limit(10);

  return NextResponse.json({ spots: data ?? [] });
}

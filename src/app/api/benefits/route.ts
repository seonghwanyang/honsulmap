import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 혜택 모음(/benefits) — 지금 살아있는 혜택 전체 (playbook §1.4).
// 베타: 등록 가게 전부 노출. 유료화 시점에 Plus 게이팅 추가 예정.
export async function GET() {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('spots')
    .select(
      'id, name, slug, region, city, category, benefit_title, benefit_detail, benefit_expires_at, benefit_updated_at',
    )
    .eq('benefit_active', true)
    .not('benefit_title', 'is', null)
    .order('benefit_updated_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 만료된 혜택 제외 (expires_at null = 상시).
  const now = Date.now();
  const benefits = (data ?? []).filter(
    (s) => !s.benefit_expires_at || new Date(s.benefit_expires_at).getTime() > now,
  );

  return NextResponse.json(
    { benefits },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
  );
}

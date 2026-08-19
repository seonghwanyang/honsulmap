import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

// 손님 페이지 폴링용 실시간 상태 — 활성 세션(좌석 점유)과 라이브 상태.
// 비공개 세션은 성별·점유 여부만, 공개 세션은 프로필까지 (우우 규칙).

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug); // 한글 slug 대응
  const { data: spot } = await supabase
    .from('spots')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();
  if (!spot) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const admin = supabaseAdmin();
  const [{ data: config }, { data: sessions }] = await Promise.all([
    admin.from('store_table_config').select('live_status').eq('spot_id', spot.id).maybeSingle(),
    admin
      .from('table_sessions')
      .select('seat_id, gender, age_band, mbti, purpose, vibe, tmi, drink_pref, is_public')
      .eq('spot_id', spot.id)
      .eq('active', true)
      .gt('expires_at', new Date().toISOString()),
  ]);

  return NextResponse.json({
    live_status: config?.live_status ?? 'open',
    sessions: (sessions ?? []).map((s) =>
      s.is_public
        ? s
        : { seat_id: s.seat_id, gender: s.gender, is_public: false },
    ),
  });
}

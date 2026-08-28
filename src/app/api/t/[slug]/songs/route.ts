import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { businessDayStart } from '@/lib/tableDay';

// 신청곡 — 큐 조회는 누구나, 신청은 체크인 세션 필수 (orders 라우트와 동일 규칙).
// 마이그레이션(2026-08-29_song_requests.sql) 전에는 GET이 빈 배열로 폴백해
// 클라이언트가 신청곡 UI를 조용히 숨긴다.

const MAX_QUEUED_PER_SESSION = 3;

async function findSpot(slug: string) {
  const { data: spot } = await supabase.from('spots').select('id').eq('slug', slug).maybeSingle();
  return spot;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug: rawSlug } = await params;
  const spot = await findSpot(decodeURIComponent(rawSlug));
  if (!spot) return NextResponse.json({ error: '가게를 찾을 수 없어요.' }, { status: 404 });

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('song_requests')
    .select('id, seat_label, title, artist, status, created_at')
    .eq('spot_id', spot.id)
    .gte('created_at', businessDayStart())
    .order('created_at', { ascending: false })
    .limit(30);

  // 테이블 미생성(마이그레이션 전) — 기능 꺼진 것처럼 동작.
  if (error) return NextResponse.json({ songs: [], available: false });
  return NextResponse.json({ songs: data ?? [], available: true });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const ip = clientIp(request);
  if (!(await rateLimit('song:req', ip, 120, 4))) {
    return NextResponse.json({ error: '신청이 너무 잦아요. 잠시 후 다시 해주세요.' }, { status: 429 });
  }

  const { slug: rawSlug } = await params;
  const spot = await findSpot(decodeURIComponent(rawSlug));
  if (!spot) return NextResponse.json({ error: '가게를 찾을 수 없어요.' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const sid = typeof body.session_id === 'string' ? body.session_id : null;
  if (!sid) return NextResponse.json({ error: '체크인이 필요해요.' }, { status: 401 });

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 60) : '';
  const artist = typeof body.artist === 'string' ? body.artist.trim().slice(0, 40) : '';
  if (!title) return NextResponse.json({ error: '곡명을 입력해주세요.' }, { status: 400 });

  const admin = supabaseAdmin();
  const { data: session } = await admin
    .from('table_sessions')
    .select('id, spot_id, seat_id, active, expires_at')
    .eq('id', sid)
    .maybeSingle();
  if (
    !session ||
    session.spot_id !== spot.id ||
    !session.active ||
    new Date(session.expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json({ error: '세션이 만료됐어요. 다시 체크인해주세요.' }, { status: 410 });
  }

  // 좌석당 대기곡 상한 — 독점 방지.
  const { count } = await admin
    .from('song_requests')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', session.id)
    .eq('status', 'queued');
  if ((count ?? 0) >= MAX_QUEUED_PER_SESSION) {
    return NextResponse.json(
      { error: `대기 중인 신청곡은 ${MAX_QUEUED_PER_SESSION}곡까지예요. 재생되면 또 신청해주세요.` },
      { status: 409 },
    );
  }

  const { data: seat } = await admin
    .from('store_seats')
    .select('label')
    .eq('id', session.seat_id)
    .maybeSingle();

  const { data: song, error } = await admin
    .from('song_requests')
    .insert({
      spot_id: spot.id,
      session_id: session.id,
      seat_label: seat?.label ?? '?',
      title,
      artist: artist || null,
    })
    .select('id, seat_label, title, artist, status, created_at')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ song }, { status: 201 });
}

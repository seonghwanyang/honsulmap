import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { sessionExpiry } from '@/lib/tableDay';

// 좌석 체크인 — 우우 방식: 좌석 + 휴대폰 뒤 4자리(해시만 저장)로 시작.
// 같은 좌석에 활성 세션이 있으면 phone4가 일치할 때만 재입장(세션 복구).
// 세션은 다음날 새벽 6시(KST)에 만료 — "영업 종료 후 자동 만료" 약속의 실체.

const PROFILE_FIELDS =
  'id, seat_id, gender, age_band, mbti, purpose, vibe, tmi, drink_pref, is_public, checked_in_at';

function hashPhone4(phone4: string, spotId: string) {
  return createHash('sha256').update(`${phone4}:${spotId}:honsulmap-table`).digest('hex');
}

async function loadSpot(slug: string) {
  const { data: spot } = await supabase
    .from('spots')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle();
  return spot;
}

// 세션 복구: GET ?sid=
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const sid = request.nextUrl.searchParams.get('sid');
  if (!sid) return NextResponse.json({ error: 'sid required' }, { status: 400 });

  const spot = await loadSpot(slug);
  if (!spot) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const admin = supabaseAdmin();
  const { data: session } = await admin
    .from('table_sessions')
    .select(`${PROFILE_FIELDS}, spot_id, active, expires_at`)
    .eq('id', sid)
    .maybeSingle();

  if (
    !session ||
    session.spot_id !== spot.id ||
    !session.active ||
    new Date(session.expires_at).getTime() < Date.now()
  ) {
    return NextResponse.json({ error: 'expired' }, { status: 410 });
  }

  const { data: seat } = await admin
    .from('store_seats')
    .select('label')
    .eq('id', session.seat_id)
    .maybeSingle();

  return NextResponse.json({ session: { ...session, seat_label: seat?.label ?? '' } });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const spot = await loadSpot(slug);
  if (!spot) return NextResponse.json({ error: '가게를 찾을 수 없어요.' }, { status: 404 });

  const admin = supabaseAdmin();
  const { data: config } = await admin
    .from('store_table_config')
    .select('enabled, modes')
    .eq('spot_id', spot.id)
    .maybeSingle();
  if (!config?.enabled)
    return NextResponse.json({ error: '테이블 서비스 준비 중이에요.' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const seatLabel = typeof body.seat_label === 'string' ? body.seat_label.trim() : '';
  const phone4 = typeof body.phone4 === 'string' ? body.phone4.trim() : '';
  const social = (config.modes as { social?: boolean } | null)?.social !== false;

  if (!seatLabel) return NextResponse.json({ error: '좌석 번호를 입력해주세요.' }, { status: 400 });
  if (!/^\d{4}$/.test(phone4))
    return NextResponse.json({ error: '휴대폰 뒤 4자리를 입력해주세요.' }, { status: 400 });

  const gender = body.gender === 'm' || body.gender === 'f' ? body.gender : null;
  if (social && !gender)
    return NextResponse.json({ error: '성별을 선택해주세요.' }, { status: 400 });

  const str = (v: unknown, max: number) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

  const { data: seat } = await admin
    .from('store_seats')
    .select('id, label, seat_type')
    .eq('spot_id', spot.id)
    .eq('label', seatLabel)
    .eq('active', true)
    .in('seat_type', ['seat', 'buffer'])
    .maybeSingle();
  if (!seat)
    return NextResponse.json({ error: '없는 좌석 번호예요. 좌석 옆 번호를 확인해주세요.' }, { status: 404 });

  const phoneHash = hashPhone4(phone4, spot.id);

  // 좌석 점유 확인 — 내 세션이면 복구, 남의 세션이면 409
  const { data: existing } = await admin
    .from('table_sessions')
    .select(`${PROFILE_FIELDS}, phone4_hash, expires_at`)
    .eq('seat_id', seat.id)
    .eq('active', true)
    .maybeSingle();

  if (existing) {
    if (new Date(existing.expires_at).getTime() < Date.now()) {
      await admin.from('table_sessions').update({ active: false }).eq('id', existing.id);
    } else if (existing.phone4_hash === phoneHash) {
      const { phone4_hash: _omit, ...pub } = existing;
      return NextResponse.json({ session: { ...pub, seat_label: seat.label } });
    } else {
      return NextResponse.json(
        { error: '이 좌석은 이미 사용 중이에요. 직원에게 문의해주세요.' },
        { status: 409 },
      );
    }
  }

  const { data: created, error } = await admin
    .from('table_sessions')
    .insert({
      spot_id: spot.id,
      seat_id: seat.id,
      phone4_hash: phoneHash,
      gender,
      age_band: str(body.age_band, 10),
      mbti: str(body.mbti, 4),
      purpose: str(body.purpose, 40),
      vibe: str(body.vibe, 20),
      tmi: str(body.tmi, 60),
      drink_pref: str(body.drink_pref, 40),
      is_public: body.is_public !== false,
      expires_at: sessionExpiry(),
    })
    .select(PROFILE_FIELDS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: { ...created, seat_label: seat.label } }, { status: 201 });
}

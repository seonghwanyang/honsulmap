import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { sessionExpiry, businessDayStart } from '@/lib/tableDay';

// 좌석 체크인 — 좌석 번호만 입력하면 시작. 사람 구분은 브라우저가 조용히
// 발급한 디바이스 UUID(해시만 저장 — phone4_hash 컬럼 재사용)로 한다.
// 같은 좌석에 활성 세션이 있으면 같은 기기일 때만 재입장(세션 복구).
// 세션은 다음날 새벽 6시(KST)에 만료 — "영업 종료 후 자동 만료" 약속의 실체.

const PROFILE_FIELDS =
  'id, seat_id, gender, age_band, mbti, purpose, vibe, tmi, drink_pref, is_public, checked_in_at';

function hashDevice(deviceId: string, spotId: string) {
  return createHash('sha256').update(`${deviceId}:${spotId}:honsulmap-table`).digest('hex');
}

// 방문 기록 — 가게×기기해시×영업일 1행 (영구, 익명). 반환값 = 누적 방문 일수(단골 지표).
// 마이그레이션(2026-08-31_data_capture.sql) 전이면 조용히 null.
async function recordVisit(
  admin: ReturnType<typeof supabaseAdmin>,
  spotId: string,
  guestKey: string,
): Promise<number | null> {
  try {
    const { error: insErr } = await admin
      .from('spot_visits')
      .insert({ spot_id: spotId, guest_key: guestKey, business_day_start: businessDayStart() });
    if (insErr && insErr.code !== '23505') return null; // 같은 날 재체크인(중복)만 무시
    const { count } = await admin
      .from('spot_visits')
      .select('id', { count: 'exact', head: true })
      .eq('spot_id', spotId)
      .eq('guest_key', guestKey);
    return count ?? null;
  } catch {
    return null;
  }
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
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug); // 한글 slug 대응
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
  if (!(await rateLimit('table-checkin', clientIp(request), 60, 8))) {
    return NextResponse.json({ error: '체크인 시도가 너무 잦아요. 잠시 후 다시 해주세요.' }, { status: 429 });
  }

  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug); // 한글 slug 대응
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
  const deviceId = typeof body.device_id === 'string' ? body.device_id.trim() : '';
  const social = (config.modes as { social?: boolean } | null)?.social !== false;

  if (!seatLabel) return NextResponse.json({ error: '좌석 번호를 입력해주세요.' }, { status: 400 });
  if (!deviceId || deviceId.length > 80)
    return NextResponse.json({ error: '잘못된 접근이에요. 새로고침 후 다시 시도해주세요.' }, { status: 400 });

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

  const phoneHash = hashDevice(deviceId, spot.id);

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
      const visitCount = await recordVisit(admin, spot.id, phoneHash);
      return NextResponse.json({ session: { ...pub, seat_label: seat.label, visit_count: visitCount } });
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
  const visitCount = await recordVisit(admin, spot.id, phoneHash);
  return NextResponse.json(
    { session: { ...created, seat_label: seat.label, visit_count: visitCount } },
    { status: 201 },
  );
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { haversineMeters } from '@/lib/utils';
import { logUserSpotEvent } from '@/lib/userSpotEvent';
import { rateLimit, clientIp } from '@/lib/rateLimit';

// 혜택 리딤 (playbook §1.1) — 무결성 3중 구조, 전부 "가게 보호" 프레이밍:
//   ① 서버 1인 1회 (UNIQUE spot+user+혜택명 — 진짜 중복 방지는 여기)
//   ② GPS 300m (서버가 거리 계산 — "지금 매장에 있다" 증명)
//   ③ PIN (사장이 설정한 경우 — 가게측 최종 승인. GPS 실패 시 우회 경로이기도)
// 성공 시 자동 체크인(spot_visits + visit 이벤트)까지 한 방에 — 체크인은 부산물.

const MAX_DISTANCE_M = 300;

type SpotRow = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  benefit_title: string | null;
  benefit_active: boolean;
  benefit_expires_at: string | null;
  redeem_pin: string | null;
};

async function loadSpot(slug: string): Promise<SpotRow | null> {
  const { data } = await supabaseAdmin()
    .from('spots')
    .select('id, name, lat, lng, benefit_title, benefit_active, benefit_expires_at, redeem_pin')
    .eq('slug', slug)
    .maybeSingle<SpotRow>();
  return data ?? null;
}

function benefitLive(spot: SpotRow): boolean {
  return !!(
    spot.benefit_active &&
    spot.benefit_title &&
    (!spot.benefit_expires_at || new Date(spot.benefit_expires_at) > new Date())
  );
}

// 현재 유저가 현 혜택을 이미 썼는지 — 버튼 상태용.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ redeemed: false });

  const spot = await loadSpot(slug);
  if (!spot || !benefitLive(spot)) return NextResponse.json({ redeemed: false });

  const { data } = await supabaseAdmin()
    .from('benefit_redemptions')
    .select('id')
    .eq('spot_id', spot.id)
    .eq('user_id', user.id)
    .eq('benefit_title', spot.benefit_title!)
    .maybeSingle();
  return NextResponse.json({ redeemed: !!data });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  if (!(await rateLimit('benefit:redeem', clientIp(request), 60, 10))) {
    return NextResponse.json({ error: '잠시 후 다시 시도해주세요.' }, { status: 429 });
  }

  const spot = await loadSpot(slug);
  if (!spot) return NextResponse.json({ error: '가게를 찾을 수 없어요.' }, { status: 404 });
  if (!benefitLive(spot)) {
    return NextResponse.json(
      { error: '지금 진행 중인 혜택이 없어요.', code: 'no_benefit' },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const lat = typeof body.lat === 'number' ? body.lat : null;
  const lng = typeof body.lng === 'number' ? body.lng : null;
  const pin = typeof body.pin === 'string' ? body.pin.trim() : '';

  // 검증 규칙 (제품 결정 2026-07-06): PIN을 설정한 가게는 GPS가 통과해도
  // 반드시 직원 PIN으로 최종 승인해야 처리된다(3중 구조 ③). GPS는 위치 확인
  // 단계일 뿐 완료 수단이 아님. PIN 미설정 가게만 GPS 300m로 바로 완료.
  let method: 'gps' | 'pin';
  // 거리는 좌표가 있으면 항상 기록(PIN 경로 포함) — 어트리뷰션 데이터.
  const distance =
    lat != null && lng != null ? Math.round(haversineMeters(lat, lng, spot.lat, spot.lng)) : null;

  if (pin) {
    if (!spot.redeem_pin || pin !== spot.redeem_pin) {
      return NextResponse.json({ error: 'PIN이 올바르지 않아요.' }, { status: 403 });
    }
    method = 'pin';
  } else if (spot.redeem_pin) {
    // PIN 필수 가게 — GPS 결과와 무관하게 직원 승인 단계로 보낸다.
    return NextResponse.json({ pin_required: true }, { status: 428 });
  } else if (distance != null) {
    if (distance > MAX_DISTANCE_M) {
      return NextResponse.json(
        { error: '가게 근처에서만 사용할 수 있어요.', distance_m: distance },
        { status: 403 },
      );
    }
    method = 'gps';
  } else {
    return NextResponse.json({ error: '위치를 확인할 수 없어요.' }, { status: 400 });
  }

  const admin = supabaseAdmin();
  const { error } = await admin.from('benefit_redemptions').insert({
    spot_id: spot.id,
    user_id: user.id,
    benefit_title: spot.benefit_title!,
    method,
    distance_m: distance,
  });
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json(
        { error: '이미 사용하신 혜택이에요.', code: 'already_redeemed' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 자동 체크인 — 체크인은 버튼이 아니라 부산물 (playbook §1.2).
  await admin.from('spot_visits').insert({ spot_id: spot.id, fingerprint: null });
  await logUserSpotEvent('visit', spot.id, { via: 'redeem' });

  return NextResponse.json({
    ok: true,
    method,
    benefit_title: spot.benefit_title,
    redeemed_at: new Date().toISOString(),
  });
}

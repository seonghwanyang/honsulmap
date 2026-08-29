import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isTableTester } from '@/lib/tableTesters';

// 배치도(구역+좌석) + 서비스 설정 조회/저장 — 사장님 에디터 전용.
// 쓰기는 전량 교체(delete & insert): 배치도 수정은 영업 전 드물게 일어나는
// 작업이고, 좌석 id가 바뀌면 활성 세션이 CASCADE로 정리되는 게 오히려 안전.

async function assertMember(spotId: string) {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user || !isTableTester(user.email)) return null; // 베타: 테스터만
  const admin = supabaseAdmin();
  const { data } = await admin
    .from('spot_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('spot_id', spotId)
    .maybeSingle();
  return data ? admin : null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = await assertMember(id);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const [{ data: spot }, { data: config }, { data: zones }, { data: seats }] = await Promise.all([
    admin.from('spots').select('name, slug').eq('id', id).single(),
    admin.from('store_table_config').select('*').eq('spot_id', id).maybeSingle(),
    admin.from('store_zones').select('*').eq('spot_id', id).order('sort'),
    admin.from('store_seats').select('*').eq('spot_id', id),
  ]);

  return NextResponse.json({
    spot,
    config,
    zones: (zones ?? []).map((z) => ({
      ...z,
      seats: (seats ?? []).filter((s) => s.zone_id === z.id),
    })),
  });
}

// 가벼운 설정 갱신 (배치도 전량 교체와 분리) — 라이브 상태 원터치(주문 보드),
// 서비스 활성화 토글(설정 허브). 체크 즉시 저장되므로 전체 저장에 묶이지 않는다.
const LIVE_STATUSES = ['ready', 'open', 'busy', 'full', 'closed'] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = await assertMember(id);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (typeof body.enabled === 'boolean') patch.enabled = body.enabled;
  if (typeof body.live_status === 'string') {
    if (!LIVE_STATUSES.includes(body.live_status as (typeof LIVE_STATUSES)[number]))
      return NextResponse.json({ error: 'invalid status' }, { status: 400 });
    patch.live_status = body.live_status;
  }

  // modes jsonb 병합 항목 — 신청곡 스위치, 토스 포스 매장 연동
  if (typeof body.songs === 'boolean' || 'toss_merchant_id' in body) {
    const { data: cfg } = await supabaseAdmin()
      .from('store_table_config')
      .select('modes')
      .eq('spot_id', id)
      .maybeSingle();
    const modes = { ...((cfg?.modes as Record<string, unknown>) ?? {}) };
    if (typeof body.songs === 'boolean') modes.songs = body.songs;
    if ('toss_merchant_id' in body) {
      const v = body.toss_merchant_id;
      if (v === null || v === '') {
        delete modes.toss_merchant_id; // 연동 해제
      } else if (typeof v === 'string' && /^\d{1,20}$/.test(v.trim())) {
        // 실제로 우리 앱이 설치된 매장인지 토스에 확인 후 저장
        const { tossFetch } = await import('@/lib/tossplace');
        const merchant = await tossFetch<{ id: number; name: string }>(`/merchants/${v.trim()}`);
        if (!merchant) {
          return NextResponse.json(
            { error: '매장 확인에 실패했어요. 포스에서 서비스 연동(코드 입력)을 먼저 해주세요.' },
            { status: 400 },
          );
        }
        modes.toss_merchant_id = v.trim();
        modes.toss_merchant_name = merchant.name ?? null;
      } else {
        return NextResponse.json({ error: '매장고유번호는 숫자만 입력해주세요.' }, { status: 400 });
      }
    }
    patch.modes = modes;
  }

  // 체크인 선택지 커스텀 (null = 기본 목록으로 복귀)
  for (const key of ['checkin_purposes', 'checkin_vibes'] as const) {
    if (!(key in body)) continue;
    const v = body[key];
    if (v === null) {
      patch[key] = null;
    } else if (
      Array.isArray(v) &&
      v.length >= 2 &&
      v.length <= 12 &&
      v.every((x) => typeof x === 'string' && x.trim().length > 0 && x.length <= 30)
    ) {
      patch[key] = v.map((x: string) => x.trim());
    } else {
      return NextResponse.json({ error: '선택지는 2~12개, 각 30자 이내로 해주세요.' }, { status: 400 });
    }
  }

  if (!Object.keys(patch).length)
    return NextResponse.json({ error: 'no fields' }, { status: 400 });

  const { error } = await admin
    .from('store_table_config')
    .upsert(
      { spot_id: id, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'spot_id' },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

interface SeatInput {
  label: string;
  row: number;
  col: number;
  seat_type: 'seat' | 'buffer' | 'block';
}
interface ZoneInput {
  name: string;
  grid_rows: number;
  grid_cols: number;
  seats: SeatInput[];
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = await assertMember(id);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const zones: ZoneInput[] = Array.isArray(body?.zones) ? body.zones : [];
  const enabled = typeof body?.enabled === 'boolean' ? body.enabled : undefined;

  if (zones.length > 10)
    return NextResponse.json({ error: '구역은 최대 10개까지예요.' }, { status: 400 });
  for (const z of zones) {
    if (!z.name?.trim() || z.name.length > 20)
      return NextResponse.json({ error: '구역 이름을 1~20자로 입력해주세요.' }, { status: 400 });
    if (z.grid_rows < 1 || z.grid_rows > 20 || z.grid_cols < 1 || z.grid_cols > 12)
      return NextResponse.json({ error: '그리드 크기가 올바르지 않아요.' }, { status: 400 });
    if (!Array.isArray(z.seats) || z.seats.length > 200)
      return NextResponse.json({ error: '좌석 데이터가 올바르지 않아요.' }, { status: 400 });
    for (const s of z.seats) {
      if (!s.label?.trim() || s.label.length > 10)
        return NextResponse.json({ error: '좌석 이름은 1~10자예요.' }, { status: 400 });
      if (!['seat', 'buffer', 'block'].includes(s.seat_type))
        return NextResponse.json({ error: '좌석 타입이 올바르지 않아요.' }, { status: 400 });
    }
  }

  // 설정 row 보장 (최초 저장 시 생성)
  const { error: cfgErr } = await admin
    .from('store_table_config')
    .upsert(
      { spot_id: id, ...(enabled !== undefined ? { enabled } : {}), updated_at: new Date().toISOString() },
      { onConflict: 'spot_id' },
    );
  if (cfgErr) return NextResponse.json({ error: cfgErr.message }, { status: 500 });

  // 전량 교체 (zones CASCADE가 seats까지 정리)
  const { error: delErr } = await admin.from('store_zones').delete().eq('spot_id', id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  for (let i = 0; i < zones.length; i++) {
    const z = zones[i];
    const { data: zone, error: zErr } = await admin
      .from('store_zones')
      .insert({ spot_id: id, name: z.name.trim(), grid_rows: z.grid_rows, grid_cols: z.grid_cols, sort: i })
      .select('id')
      .single();
    if (zErr) return NextResponse.json({ error: zErr.message }, { status: 500 });

    if (z.seats.length) {
      const { error: sErr } = await admin.from('store_seats').insert(
        z.seats.map((s) => ({
          zone_id: zone.id,
          spot_id: id,
          label: s.label.trim(),
          row: s.row,
          col: s.col,
          seat_type: s.seat_type,
        })),
      );
      if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

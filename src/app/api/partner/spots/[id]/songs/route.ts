import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { businessDayStart } from '@/lib/tableDay';
import { isTableTester } from '@/lib/tableTesters';

// 신청곡 보드 (사장님) — 주문 보드와 같은 폴링 사이클에서 호출.
// GET: 오늘 영업분 신청곡. PATCH: 재생됨/건너뜀 처리.

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

  const { data, error } = await admin
    .from('song_requests')
    .select('id, seat_label, title, artist, status, created_at')
    .eq('spot_id', id)
    .gte('created_at', businessDayStart())
    .order('created_at', { ascending: false })
    .limit(100);

  // 마이그레이션 전 — 보드는 신청곡 패널을 숨긴다.
  if (error) return NextResponse.json({ songs: [], available: false });
  return NextResponse.json({ songs: data ?? [], available: true });
}

const VALID = ['queued', 'played', 'skipped'] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = await assertMember(id);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const songId = typeof body.id === 'string' ? body.id : null;
  const status = VALID.includes(body.status) ? (body.status as (typeof VALID)[number]) : null;
  if (!songId || !status)
    return NextResponse.json({ error: 'invalid request' }, { status: 400 });

  const { error } = await admin
    .from('song_requests')
    .update({ status })
    .eq('id', songId)
    .eq('spot_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

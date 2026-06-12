import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { VALID_REGIONS } from '@/lib/types';

const VALID_CATEGORIES = ['bar', 'guesthouse'] as const;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const ig_handle =
    typeof body.ig_handle === 'string' ? body.ig_handle.trim().replace(/^@/, '') : '';
  const region = typeof body.region === 'string' ? body.region : '';
  const category = typeof body.category === 'string' ? body.category : 'bar';
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  const fingerprint = typeof body.fingerprint === 'string' ? body.fingerprint : '';

  if (!name || name.length > 80) {
    return NextResponse.json({ error: '가게명을 1~80자로 입력해주세요.' }, { status: 400 });
  }
  if (!VALID_REGIONS.includes(region as (typeof VALID_REGIONS)[number])) {
    return NextResponse.json({ error: '지역을 선택해주세요.' }, { status: 400 });
  }
  if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
    return NextResponse.json({ error: '카테고리를 선택해주세요.' }, { status: 400 });
  }
  if (ig_handle.length > 60) {
    return NextResponse.json({ error: '인스타 계정은 60자 이내로 입력해주세요.' }, { status: 400 });
  }
  if (address.length > 200) {
    return NextResponse.json({ error: '주소는 200자 이내로 입력해주세요.' }, { status: 400 });
  }
  if (note.length > 500) {
    return NextResponse.json({ error: '메모는 500자 이내로 입력해주세요.' }, { status: 400 });
  }

  // Block double-submits: if this IG handle already has a request awaiting
  // review, don't queue another (users were resubmitting the same shop
  // seconds apart with tweaked memos). Needs the service role — anon has
  // INSERT but no SELECT on spot_requests (RLS). Fails open on error so a
  // misconfig never blocks legit submissions.
  if (ig_handle) {
    const { data: pendingDup } = await supabaseAdmin()
      .from('spot_requests')
      .select('id')
      .eq('ig_handle', ig_handle)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();
    if (pendingDup) {
      return NextResponse.json(
        { error: '이미 검토 대기 중인 같은 인스타 계정의 요청이 있어요.' },
        { status: 409 },
      );
    }
  }

  const { error } = await supabase.from('spot_requests').insert([
    {
      name,
      ig_handle: ig_handle || null,
      region,
      category,
      address: address || null,
      note: note || null,
      fingerprint: fingerprint || null,
    },
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

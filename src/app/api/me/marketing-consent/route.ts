import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

// 마케팅 수신 동의 상태 조회/갱신. 본인 것만 (RLS self) — 신원은 세션 쿠키.
export async function GET() {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data } = await sb
    .from('marketing_consent')
    .select('opted_in, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  return NextResponse.json({ opted_in: !!data?.opted_in, updated_at: data?.updated_at ?? null });
}

export async function PUT(request: Request) {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const opted_in = body?.opted_in === true;
  const source = typeof body?.source === 'string' ? body.source.slice(0, 32) : null;

  const { error } = await sb
    .from('marketing_consent')
    .upsert(
      { user_id: user.id, opted_in, source, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ opted_in });
}

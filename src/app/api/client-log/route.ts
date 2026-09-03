import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createServerSupabase } from '@/lib/supabase/server';
import { rateLimit, clientIp } from '@/lib/rateLimit';

// 클라이언트 오류·인증전이 원격 수집 — "로그인이 풀린다" 류 야생 버그의 증거 확보용.
// tossplace_events 재사용(event_type='client.log') — 마이그레이션 불필요.
// 항상 200: 로깅 실패가 클라이언트에 에러로 보이면 안 됨.
export async function POST(request: NextRequest) {
  if (!(await rateLimit('client-log', clientIp(request), 60, 30))) return NextResponse.json({ ok: true });
  const body = await request.json().catch(() => ({}));

  let uid: string | null = null;
  try {
    const sb = await createServerSupabase();
    uid = (await sb.auth.getUser()).data.user?.id ?? null;
  } catch {
    /* 익명 */
  }

  await supabaseAdmin()
    .from('tossplace_events')
    .insert({
      event_type: 'client.log',
      payload: {
        level: String(body.level ?? 'error').slice(0, 10),
        msg: String(body.msg ?? '').slice(0, 300),
        detail: String(body.detail ?? '').slice(0, 600),
        url: String(body.url ?? '').slice(0, 200),
        ua: request.headers.get('user-agent')?.slice(0, 160) ?? null,
        uid,
      },
      headers: {},
    })
    .then(({ error }) => {
      if (error) console.warn('[client-log] store failed:', error.message);
    });

  return NextResponse.json({ ok: true });
}

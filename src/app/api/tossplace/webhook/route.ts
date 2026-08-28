import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 토스플레이스 웹훅 수신 — 개발자센터에 등록하는 Payload URL.
// 이벤트를 tossplace_events에 원본 보관하고 즉시 200 (토스는 실패 시 재시도하므로
// 저장 실패해도 200은 유지, 콘솔 로그로 흔적만 남긴다).
// 서명 검증은 토스 문서의 시그니처 스펙 확인 후 추가 예정 — 그때까지 수신만.

export async function GET() {
  // URL 등록 시 검증 핑 대비
  return NextResponse.json({ ok: true, service: 'honsulmap-table' });
}

export async function POST(request: NextRequest) {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = { raw: await request.text().catch(() => '') };
  }

  const p = (payload ?? {}) as Record<string, unknown>;
  const eventType =
    (typeof p.eventType === 'string' && p.eventType) ||
    (typeof p.event_type === 'string' && p.event_type) ||
    (typeof p.type === 'string' && p.type) ||
    null;

  // 서명/추적용 헤더만 선별 보관
  const headers: Record<string, string> = {};
  for (const [k, v] of request.headers.entries()) {
    if (/^(x-|toss|content-type|user-agent)/i.test(k)) headers[k] = v;
  }

  try {
    const { error } = await supabaseAdmin()
      .from('tossplace_events')
      .insert({ event_type: eventType, payload: p, headers });
    if (error) console.error('[tossplace] store failed:', error.message, eventType);
  } catch (e) {
    console.error('[tossplace] store threw:', (e as Error).message);
  }

  return NextResponse.json({ ok: true });
}

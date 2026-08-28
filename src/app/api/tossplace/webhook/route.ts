import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

// 토스플레이스 웹훅 수신 — 개발자센터에 등록하는 Payload URL.
// 이벤트를 tossplace_events에 원본 보관하고 즉시 200 (토스는 실패 시 재시도하므로
// 저장 실패해도 200은 유지, 콘솔 로그로 흔적만 남긴다).
//
// 서명 검증: TOSSPLACE_WEBHOOK_SECRET로 HMAC-SHA256(hex/base64)을 계산해
// signature류 헤더와 대조한 결과를 이벤트에 기록한다. 토스의 정확한 서명 스펙을
// 실이벤트로 확인하기 전까지는 관찰 모드(불일치여도 200) — 확인 후 거부로 전환.

export async function GET() {
  // URL 등록 시 검증 핑 대비
  return NextResponse.json({ ok: true, service: 'honsulmap-table' });
}

function sigCheck(rawBody: string, headers: Record<string, string>) {
  const secret = process.env.TOSSPLACE_WEBHOOK_SECRET;
  if (!secret) return { mode: 'no-secret' };
  const hex = createHmac('sha256', secret).update(rawBody).digest('hex');
  const b64 = createHmac('sha256', secret).update(rawBody).digest('base64');
  const sigHeader = Object.entries(headers).find(([k]) => k.toLowerCase().includes('signature'));
  if (!sigHeader) return { mode: 'no-signature-header', hex: hex.slice(0, 12) };
  const got = sigHeader[1];
  const match = got === hex || got === b64 || got === `sha256=${hex}` || got === `sha256=${b64}`;
  return { mode: 'checked', header: sigHeader[0], match };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text().catch(() => '');
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = { raw: rawBody };
  }

  const eventType =
    (typeof payload.eventType === 'string' && payload.eventType) ||
    (typeof payload.event_type === 'string' && payload.event_type) ||
    (typeof payload.type === 'string' && payload.type) ||
    null;

  // 서명/추적용 헤더만 선별 보관
  const headers: Record<string, string> = {};
  for (const [k, v] of request.headers.entries()) {
    if (/^(x-|toss|content-type|user-agent)/i.test(k)) headers[k] = v;
  }

  const sig = sigCheck(rawBody, headers);
  if (sig.mode === 'checked' && !sig.match) {
    console.warn('[tossplace] signature mismatch:', sig.header, eventType);
  }

  try {
    const { error } = await supabaseAdmin()
      .from('tossplace_events')
      .insert({ event_type: eventType, payload, headers: { ...headers, _sig: sig } });
    if (error) console.error('[tossplace] store failed:', error.message, eventType);
  } catch (e) {
    console.error('[tossplace] store threw:', (e as Error).message);
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

// 토스플레이스 웹훅 수신 — 개발자센터에 등록하는 Payload URL.
// 서명 검증 (공식 스펙 docs.tossplace.com/reference/open-api/webhook.html):
//   x-toss-signature: "v1=" + hex( HMAC-SHA256(secret, `${x-toss-timestamp}.${rawBody}`) )
//   x-toss-timestamp: epoch ms — 5분 이상 어긋나면 리플레이로 간주해 거부.
//   x-toss-webhook-id: 재시도 멱등키 (원본 보관 단계라 저장은 중복 허용, 처리 시 dedupe).
// 시크릿(TOSSPLACE_WEBHOOK_SECRET) 미설정이면 검증 없이 수신만 (Vercel env 등록 전 과도기).
// 검증 실패는 401 — 토스가 실패로 보고 재시도한다.

const REPLAY_TOLERANCE_MS = 5 * 60 * 1000;

export async function GET() {
  return NextResponse.json({ ok: true, service: 'honsulmap-table' });
}

function verifySignature(rawBody: string, headers: Headers): { ok: boolean; mode: string } {
  const secret = process.env.TOSSPLACE_WEBHOOK_SECRET;
  if (!secret) return { ok: true, mode: 'no-secret' };

  const sig = headers.get('x-toss-signature');
  const ts = headers.get('x-toss-timestamp');
  if (!sig || !ts) return { ok: false, mode: 'missing-headers' };

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() - tsNum) > REPLAY_TOLERANCE_MS) {
    return { ok: false, mode: 'stale-timestamp' };
  }

  const expected = `v1=${createHmac('sha256', secret).update(`${ts}.${rawBody}`, 'utf8').digest('hex')}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  const match = a.length === b.length && timingSafeEqual(a, b);
  return { ok: match, mode: match ? 'verified' : 'mismatch' };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text().catch(() => '');

  const sig = verifySignature(rawBody, request.headers);
  if (!sig.ok) {
    console.warn('[tossplace] webhook rejected:', sig.mode);
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = { raw: rawBody };
  }

  // 공식 봉투: { id, type, createdAt, merchantId, app, data }
  const eventType = (typeof payload.type === 'string' && payload.type) || null;

  const headers: Record<string, string> = {};
  for (const [k, v] of request.headers.entries()) {
    if (/^(x-|toss|content-type|user-agent)/i.test(k)) headers[k] = v;
  }

  try {
    const { error } = await supabaseAdmin()
      .from('tossplace_events')
      .insert({ event_type: eventType, payload, headers: { ...headers, _sig_mode: sig.mode } });
    if (error) console.error('[tossplace] store failed:', error.message, eventType);
  } catch (e) {
    console.error('[tossplace] store threw:', (e as Error).message);
  }

  return NextResponse.json({ ok: true });
}

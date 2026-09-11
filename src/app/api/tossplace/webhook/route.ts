import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { reportError } from '@/lib/serverError';
import { supabaseAdmin } from '@/lib/supabase';
import { extractOrderUuid } from '@/lib/tossplace';

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
    // 서명 실패는 시크릿 불일치(설정 사고)거나 위조 시도 — 둘 다 알아야 한다
    reportError(new Error('tossplace webhook rejected'), { level: 'warning', extra: { mode: sig.mode } });
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
    if (error) {
      console.error('[tossplace] store failed:', error.message, eventType);
      reportError(error, { extra: { where: 'tossplace store', eventType } });
    }
  } catch (e) {
    console.error('[tossplace] store threw:', (e as Error).message);
    reportError(e, { extra: { where: 'tossplace store', eventType } });
  }

  // ── 좌석 자동 체크아웃 ──
  // 우리가 만든 포스 주문(orderKey = 우리 주문 id)이 결제·완료/취소되면 우리 주문
  // 상태를 맞추고, 그 좌석(세션)의 주방 주문이 전부 완결됐으면 좌석을 비운다.
  // 테이블 단위가 아니라 좌석 단위 로직이라 현황 탭 방식·플러그인 방식 모두에서 동작.
  try {
    if (eventType === 'order.order.completed.v1' || eventType === 'order.order.cancelled.v1') {
      const data = (payload.data ?? {}) as { orderKey?: unknown; orderId?: unknown };
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const admin = supabaseAdmin();
      const ids = new Set<string>();

      const rawKey = typeof data.orderKey === 'string' ? data.orderKey : '';
      const primary = extractOrderUuid(rawKey); // "Q007_uuid"·"-fb/-retry" 접미사 → 원 UUID
      if (UUID_RE.test(primary)) ids.add(primary);

      // addMenu(v3.1)로 한 포스 주문에 합쳐진 형제 주문들 — 같은 toss_order_id로
      // ack된 우리 주문 전부를 함께 완결한다 (orderKey는 첫 주문 것만 오므로).
      const tossId = data.orderId != null ? String(data.orderId) : '';
      if (tossId) {
        const { data: acks } = await admin
          .from('tossplace_events')
          .select('payload')
          .eq('event_type', 'plugin.push.ack')
          .eq('payload->>toss_order_id', tossId);
        for (const a of acks ?? []) {
          const oid = extractOrderUuid(String((a.payload as { order_id?: string })?.order_id ?? ''));
          if (UUID_RE.test(oid)) ids.add(oid);
        }
      }

      // 자리이동 레이스 가드 — 이동은 "새 테이블 재생성 → 원 주문 취소" 순서라, 원 주문의
      // 취소 웹훅이 remap ack보다 먼저 도착할 수 있다 (실측 9/10 00:58 좌석10: 1초 차로
      // 세션이 오폭 체크아웃됨). 같은 UUID의 "-mv" 재생성 주문(created)이 직전에 있으면
      // 이 취소는 이동 부산물 → 완결 대상에서 제외. 단, 취소된 키 자체가 -mv로 끝나면
      // 재생성분의 진짜 취소이므로 가드를 건너뛴다.
      if (ids.size && eventType === 'order.order.cancelled.v1' && !/-(mv)+$/.test(rawKey.split('_').pop() ?? '')) {
        for (const uuid of [...ids]) {
          const { data: mv } = await admin
            .from('tossplace_events')
            .select('id')
            .eq('event_type', 'order.order.created.v1')
            .gte('created_at', new Date(Date.now() - 10 * 60000).toISOString())
            .like('payload->data->>orderKey', `%${uuid}%-mv%`)
            .limit(1);
          if (mv?.length) ids.delete(uuid);
        }
      }

      // 자리이동 가드 — 이동은 "새 테이블 재생성 + 옛 주문 취소"로 구현되는데, 옛 주문의
      // 취소 웹훅이 이동된 우리 주문을 진짜 취소로 오인하면 안 된다. 최신 ack(added/remap)의
      // toss_order_id가 이 웹훅의 포스 주문과 다르면 이미 딴 주문으로 이관된 것 → 제외.
      if (ids.size && tossId) {
        const { data: guardAcks } = await admin
          .from('tossplace_events')
          .select('payload, created_at')
          .eq('event_type', 'plugin.push.ack')
          .in('payload->>order_id', [...ids]);
        const latest = new Map<string, string>();
        for (const a of (guardAcks ?? []).sort((x, y) =>
          String(x.created_at).localeCompare(String(y.created_at)),
        )) {
          const p = a.payload as { order_id?: string; toss_order_id?: unknown };
          if (p?.order_id && p.toss_order_id != null) latest.set(p.order_id, String(p.toss_order_id));
        }
        for (const [uuid, tid] of latest) if (tid !== tossId) ids.delete(uuid);
      }

      if (ids.size) {
        const idList = [...ids];
        const newStatus = eventType === 'order.order.cancelled.v1' ? 'canceled' : 'done';
        const { data: ours } = await admin.from('table_orders').select('id, session_id').in('id', idList);
        if (ours?.length) {
          await admin
            .from('table_orders')
            .update({ status: newStatus })
            .in('id', idList)
            .in('status', ['new', 'accepted']);
          // 완료(결제)든 취소든 "계산서가 닫힌 것" — 그 세션에 살아있는 주문이 없으면 좌석을
          // 비운다. 기존엔 done만 비워서 포스 "테이블 취소" 시 혼술맵 체크인이 남았음
          // (실측: 9/9 03시 좌석1). 일부 주문만 취소된 경우는 remain 가드가 좌석을 지킨다.
          {
            const sessions = [...new Set(ours.map((o) => o.session_id).filter(Boolean))] as string[];
            for (const sid of sessions) {
              const { data: remain } = await admin
                .from('table_orders')
                .select('id')
                .eq('session_id', sid)
                .gt('total', 0)
                .in('status', ['new', 'accepted'])
                .limit(1);
              if (!remain?.length) {
                await admin.from('table_sessions').update({ active: false }).eq('id', sid).eq('active', true);
                console.log('[auto-checkout] 좌석 자동 체크아웃 — session', sid);
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('[auto-checkout] 처리 실패:', (e as Error).message);
    // 결제·취소 웹훅을 받았는데 우리 주문 상태를 못 맞춘 것 — 좌석이 안 비워지는 실측 사고의 원인 후보
    reportError(e, { extra: { where: 'auto-checkout', eventType } });
  }

  return NextResponse.json({ ok: true });
}

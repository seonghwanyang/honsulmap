import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { assertAdmin } from '@/lib/adminAuth';
import { businessDayStart } from '@/lib/tableDay';
import { extractOrderUuid, tossMerchantId, tossPushMode } from '@/lib/tossplace';

// 운영 모니터 (/admin/monitor) — 포스 플러그인이 살아 있는지·어느 버전인지, 오늘 QR 주문이
// 포스에 들어갔는지(ack), 스크래퍼가 도는지를 한 화면에. scripts/_check_plugin_status.mjs 와
// Supabase 수동 조회로 보던 것을 대신한다. 읽기 전용.
// tossplace_events 에는 매장 컬럼이 없어 payload->>mid(플러그인·ack) / payload->>merchantId(웹훅)로 거른다.

const PLUGIN_ALIVE_SEC = 180; // 하트비트(plugin_last_seen)는 폴링 중 60초에 1번 갱신 — 3분 넘게 없으면 죽은 것
const STUCK_AFTER_SEC = 90; // sweepUnackedPluginOrders 의 폴백 기준과 동일
const SCRAPER_STALE_MIN = Number(process.env.SCRAPER_STALE_MIN ?? 5); // /api/health/scraper 와 동일

const ageSec = (iso: string | null | undefined) =>
  iso ? Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000)) : null;

export async function GET(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const db = supabaseAdmin();
  const dayStart = businessDayStart();
  const h1 = new Date(Date.now() - 3600_000).toISOString();
  const d1 = new Date(Date.now() - 86400_000).toISOString();

  const [{ data: cfgs }, { data: scraped }] = await Promise.all([
    db.from('store_table_config').select('spot_id, modes').not('modes->>toss_merchant_id', 'is', null),
    db
      .from('spots')
      .select('last_scraped_at')
      .not('last_scraped_at', 'is', null)
      .order('last_scraped_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const spotIds = (cfgs ?? []).map((c) => c.spot_id as string);
  const { data: spots } = spotIds.length ? await db.from('spots').select('id, name, slug').in('id', spotIds) : { data: [] };
  const spotMap = new Map((spots ?? []).map((s) => [s.id as string, s]));

  const stores = await Promise.all(
    (cfgs ?? []).map(async (c) => {
      const spotId = c.spot_id as string;
      const mid = tossMerchantId(c.modes) ?? '';
      const mode = tossPushMode(c.modes);
      const modes = (c.modes ?? {}) as { plugin_last_seen?: string };
      const ev = () => db.from('tossplace_events');

      const [
        { data: startLog },
        { data: logs },
        { count: warnings1h },
        { count: pendingReports24h },
        { data: lastPosEvent },
        { data: orders },
        { data: acks },
      ] = await Promise.all([
        ev()
          .select('payload, created_at')
          .eq('event_type', 'plugin.log')
          .eq('payload->>mid', mid)
          .like('payload->>msg', '플러그인 시작%')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        ev().select('payload, created_at').eq('event_type', 'plugin.log').eq('payload->>mid', mid).order('created_at', { ascending: false }).limit(8),
        ev().select('id', { count: 'exact', head: true }).eq('event_type', 'plugin.log').eq('payload->>mid', mid).neq('payload->>level', 'info').gte('created_at', h1),
        ev().select('id', { count: 'exact', head: true }).eq('event_type', 'pos.order.pending').eq('payload->>mid', mid).gte('created_at', d1),
        // 토스 웹훅(주문 생성·결제·취소)은 포스가 켜져 있어야만 온다 — "포스 마지막 활동" 근사치
        ev().select('event_type, created_at').like('event_type', 'order.%').eq('payload->>merchantId', mid).gte('created_at', d1).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        db
          .from('table_orders')
          .select('id, seat_label, total, status, created_at')
          .eq('spot_id', spotId)
          .gte('created_at', dayStart)
          .gt('total', 0)
          .order('created_at', { ascending: false }),
        ev().select('payload, created_at').eq('event_type', 'plugin.push.ack').eq('payload->>mid', mid).gte('created_at', dayStart),
      ]);

      // 주문별 최신 ack 결과 (added / pos-import / timeout-fallback / unmatched / error / remap …)
      const latestAck = new Map<string, string>();
      for (const a of [...(acks ?? [])].sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)))) {
        const p = a.payload as { order_id?: string; outcome?: string };
        if (p?.order_id && p.outcome) latestAck.set(extractOrderUuid(p.order_id), p.outcome);
      }
      const byOutcome: Record<string, number> = {};
      const stuck: { id: string; seat_label: string; total: number; status: string; created_at: string; age_sec: number }[] = [];
      let waiting = 0;
      for (const o of orders ?? []) {
        const outcome = latestAck.get(o.id) ?? 'none';
        byOutcome[outcome] = (byOutcome[outcome] ?? 0) + 1;
        if (mode !== 'plugin' || outcome !== 'none' || !['new', 'accepted'].includes(o.status)) continue;
        const age = ageSec(o.created_at) ?? 0;
        if (age >= STUCK_AFTER_SEC) stuck.push({ id: o.id, seat_label: o.seat_label, total: o.total, status: o.status, created_at: o.created_at, age_sec: age });
        else waiting += 1;
      }

      const startMsg = String((startLog?.payload as { msg?: string } | null)?.msg ?? '');
      const lastSeenAge = ageSec(modes.plugin_last_seen);

      return {
        spot_id: spotId,
        name: spotMap.get(spotId)?.name ?? '(이름 없음)',
        slug: spotMap.get(spotId)?.slug ?? '',
        mid,
        mode,
        plugin: {
          last_seen: modes.plugin_last_seen ?? null,
          last_seen_age_sec: lastSeenAge,
          alive: lastSeenAge !== null && lastSeenAge <= PLUGIN_ALIVE_SEC,
          version: /플러그인 시작 v([\d.]+)/.exec(startMsg)?.[1] ?? null,
          started_at: startLog?.created_at ?? null,
          warnings_1h: warnings1h ?? 0,
          pending_reports_24h: pendingReports24h ?? 0,
          logs: (logs ?? []).map((l) => {
            const p = l.payload as { level?: string; msg?: string };
            return { at: l.created_at as string, level: p?.level ?? '', msg: p?.msg ?? '' };
          }),
        },
        pos: {
          last_event_type: lastPosEvent?.event_type ?? null,
          last_event_at: lastPosEvent?.created_at ?? null,
          last_event_age_sec: ageSec(lastPosEvent?.created_at),
        },
        orders: { today: (orders ?? []).length, by_outcome: byOutcome, stuck, waiting },
      };
    }),
  );

  const scraperAge = ageSec(scraped?.last_scraped_at);
  return NextResponse.json({
    now: new Date().toISOString(),
    day_start: dayStart,
    thresholds: { plugin_alive_sec: PLUGIN_ALIVE_SEC, stuck_after_sec: STUCK_AFTER_SEC, scraper_stale_min: SCRAPER_STALE_MIN },
    stores,
    scraper: {
      last_scraped_at: scraped?.last_scraped_at ?? null,
      age_sec: scraperAge,
      ok: scraperAge !== null && scraperAge <= SCRAPER_STALE_MIN * 60,
    },
  });
}

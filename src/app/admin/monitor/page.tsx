'use client';

import { useCallback, useEffect, useState } from 'react';

// 운영 모니터 — 포스 플러그인 생존/버전, 오늘 QR 주문의 포스 도달(ack), 스크래퍼 신선도.
// 30초마다 자동 갱신(탭이 숨겨져 있으면 쉼). 데이터는 /api/admin/monitor.

interface Store {
  spot_id: string;
  name: string;
  slug: string;
  mid: string;
  mode: 'plugin' | 'openapi';
  plugin: {
    last_seen: string | null;
    last_seen_age_sec: number | null;
    alive: boolean;
    version: string | null;
    started_at: string | null;
    warnings_1h: number;
    pending_reports_24h: number;
    logs: { at: string; level: string; msg: string }[];
  };
  pos: { last_event_type: string | null; last_event_at: string | null; last_event_age_sec: number | null };
  orders: {
    today: number;
    by_outcome: Record<string, number>;
    stuck: { id: string; seat_label: string; total: number; status: string; created_at: string; age_sec: number }[];
    waiting: number;
  };
}

interface Monitor {
  now: string;
  thresholds: { plugin_alive_sec: number; stuck_after_sec: number; scraper_stale_min: number };
  stores: Store[];
  scraper: { last_scraped_at: string | null; age_sec: number | null; ok: boolean };
}

const REFRESH_MS = 30_000;
const GREEN = '#16a34a';
const RED = '#dc2626';
const AMBER = '#d97706';
const GRAY = '#6b7280';

const OUTCOME_LABEL: Record<string, string> = {
  added: '테이블 반영',
  'pos-import': '포스 직접 주문',
  'timeout-fallback': '폴백(플러그인 무응답)',
  error: '폴백(반영 실패)',
  unmatched: '폴백(메뉴 미매칭)',
  moved: '자리이동',
  remap: '자리이동 재지정',
  none: '미확인',
};

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function ago(sec: number | null) {
  if (sec === null) return '기록 없음';
  if (sec < 60) return `${sec}초 전`;
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 ${Math.floor((sec % 3600) / 60)}분 전`;
  return `${Math.floor(sec / 86400)}일 전`;
}

export default function AdminMonitorPage() {
  const [data, setData] = useState<Monitor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/monitor', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
      setError(null);
      setUpdatedAt(new Date());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (!document.hidden) load();
    }, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const problems: string[] = [];
  if (data) {
    for (const s of data.stores) {
      if (s.mode === 'plugin' && !s.plugin.alive) problems.push(`${s.name}: 플러그인 끊김 (마지막 폴링 ${ago(s.plugin.last_seen_age_sec)})`);
      if (s.orders.stuck.length) problems.push(`${s.name}: 포스에 안 들어간 주문 ${s.orders.stuck.length}건`);
    }
    if (!data.scraper.ok) problems.push(`스크래퍼 멈춤 (마지막 수집 ${ago(data.scraper.age_sec)})`);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#111827' }}>
            모니터링
          </h1>
          <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
            포스 플러그인 · 오늘 주문의 포스 도달 · 스크래퍼. 30초마다 자동 갱신
            {updatedAt ? ` · 마지막 갱신 ${updatedAt.toLocaleTimeString('ko-KR', { hour12: false })}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="text-xs px-3 py-1.5 rounded bg-white whitespace-nowrap flex-shrink-0"
          style={{ border: '1px solid #e5e7eb', color: '#374151' }}
        >
          새로고침
        </button>
      </div>

      {error && (
        <div className="text-xs" style={{ color: RED }}>
          불러오기 실패: {error}
        </div>
      )}
      {!data && !error && (
        <div className="text-xs" style={{ color: '#9ca3af' }}>
          불러오는 중…
        </div>
      )}

      {data && (
        <>
          <div
            className="p-3 text-xs font-bold"
            style={{
              borderRadius: 10,
              background: problems.length ? '#fef2f2' : '#f0fdf4',
              color: problems.length ? RED : GREEN,
              border: `1px solid ${problems.length ? '#fecaca' : '#bbf7d0'}`,
            }}
          >
            {problems.length ? (
              <ul className="space-y-1">
                {problems.map((p) => (
                  <li key={p}>⚠ {p}</li>
                ))}
              </ul>
            ) : (
              '✓ 모두 정상'
            )}
          </div>

          {data.stores.map((s) => (
            <StoreCard key={s.spot_id} s={s} thresholds={data.thresholds} />
          ))}
          {!data.stores.length && (
            <div className="text-xs" style={{ color: GRAY }}>
              토스 연동 매장이 없습니다.
            </div>
          )}

          <Card title="스크래퍼 (갤탭)">
            <div className="grid grid-cols-3 gap-2">
              <Metric label="상태" value={data.scraper.ok ? '● 수집 중' : '● 멈춤'} color={data.scraper.ok ? GREEN : RED} />
              <Metric label="마지막 수집" value={ago(data.scraper.age_sec)} sub={fmt(data.scraper.last_scraped_at)} />
              <Metric label="기준" value={`${data.thresholds.scraper_stale_min}분`} sub="/api/health/scraper 와 동일" />
            </div>
          </Card>

          <div className="flex flex-wrap gap-3 text-xs" style={{ color: GRAY }}>
            <Ext href="https://synaptic-vl.sentry.io/issues/">Sentry 이슈</Ext>
            <Ext href="https://synaptic-vl.sentry.io/crons/">Sentry 크론(자동 마감)</Ext>
            <Ext href="https://supabase.com/dashboard/project/kmhztgauczzqgqlehuow">Supabase</Ext>
            <Ext href="https://dashboard.uptimerobot.com/">UptimeRobot</Ext>
            <Ext href="/api/health/scraper">/api/health/scraper</Ext>
          </div>
        </>
      )}
    </div>
  );
}

function StoreCard({ s, thresholds }: { s: Store; thresholds: Monitor['thresholds'] }) {
  const p = s.plugin;
  const pluginText = s.mode !== 'plugin' ? '미사용 (직접 전송)' : p.alive ? '● 폴링 중' : '● 끊김';
  const pluginColor = s.mode !== 'plugin' ? GRAY : p.alive ? GREEN : RED;
  const outcomes = Object.entries(s.orders.by_outcome).sort((a, b) => b[1] - a[1]);

  return (
    <Card
      title={`${s.name} · 매장번호 ${s.mid}`}
      right={
        <span
          className="text-[11px] px-2 py-0.5 rounded-full"
          style={{ background: '#f3f4f6', color: '#374151' }}
        >
          {s.mode === 'plugin' ? '플러그인 모드' : 'Open API 직접 전송'}
        </span>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metric label="플러그인" value={pluginText} color={pluginColor} sub={`마지막 폴링 ${ago(p.last_seen_age_sec)}`} />
        <Metric
          label="플러그인 버전"
          value={p.version ? `v${p.version}` : '기록 없음'}
          sub={p.started_at ? `시작 ${fmt(p.started_at)}` : '시작 로그 없음'}
        />
        <Metric
          label="포스 마지막 활동"
          value={ago(s.pos.last_event_age_sec)}
          sub={s.pos.last_event_type ? `${s.pos.last_event_type} · 웹훅 기준` : '24시간 내 웹훅 없음'}
        />
        <Metric
          label="플러그인 경고 (1시간)"
          value={`${p.warnings_1h}건`}
          color={p.warnings_1h ? AMBER : undefined}
          sub={`포스 주문 보고(보류) 24h ${p.pending_reports_24h}건`}
        />
      </div>

      <div className="mt-4">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#111827' }}>오늘 영업분 주문 {s.orders.today}건</span>
          {outcomes.map(([k, n]) => (
            <span key={k} className="text-[11px]" style={{ color: k === 'none' ? RED : GRAY }}>
              {OUTCOME_LABEL[k] ?? k} {n}
            </span>
          ))}
          {s.mode === 'plugin' && s.orders.waiting > 0 && (
            <span className="text-[11px]" style={{ color: AMBER }}>
              처리 대기 {s.orders.waiting} ({thresholds.stuck_after_sec}초 이내)
            </span>
          )}
        </div>

        {s.orders.stuck.length > 0 && (
          <div className="mt-2 overflow-x-auto" style={{ border: '1px solid #fecaca', borderRadius: 8 }}>
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fef2f2', color: RED }}>
                  <th className="text-left px-3 py-1.5 font-bold" colSpan={5}>
                    포스에 안 들어간 주문 {s.orders.stuck.length}건 — ack 없이 {thresholds.stuck_after_sec}초 초과
                  </th>
                </tr>
                <tr style={{ color: GRAY }}>
                  <th className="text-left px-3 py-1 font-medium whitespace-nowrap">좌석</th>
                  <th className="text-right px-3 py-1 font-medium whitespace-nowrap">금액</th>
                  <th className="text-left px-3 py-1 font-medium whitespace-nowrap">접수</th>
                  <th className="text-left px-3 py-1 font-medium whitespace-nowrap">경과</th>
                  <th className="text-left px-3 py-1 font-medium whitespace-nowrap">상태</th>
                </tr>
              </thead>
              <tbody>
                {s.orders.stuck.map((o) => (
                  <tr key={o.id} style={{ borderTop: '1px solid #fee2e2', color: '#111827' }}>
                    <td className="px-3 py-1.5 font-bold">{o.seat_label}</td>
                    <td className="px-3 py-1.5 text-right">{o.total.toLocaleString('ko-KR')}원</td>
                    <td className="px-3 py-1.5">{fmt(o.created_at)}</td>
                    <td className="px-3 py-1.5" style={{ color: RED }}>
                      {ago(o.age_sec)}
                    </td>
                    <td className="px-3 py-1.5">{o.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {p.logs.length > 0 && (
        <div className="mt-4">
          <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111827', marginBottom: 6 }}>플러그인 최근 로그</div>
          <ul className="space-y-1 text-[11px]" style={{ fontFamily: 'ui-monospace, monospace' }}>
            {p.logs.map((l, i) => (
              <li key={`${l.at}-${i}`} className="flex gap-2">
                <span style={{ color: '#9ca3af', flexShrink: 0 }}>{fmt(l.at)}</span>
                <span style={{ color: l.level === 'error' ? RED : l.level === 'warn' ? AMBER : GRAY, flexShrink: 0 }}>{l.level}</span>
                <span style={{ color: '#374151' }}>{l.msg}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Card({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white p-4" style={{ border: '1px solid #e5e7eb', borderRadius: 10 }}>
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="p-3" style={{ background: '#f9fafb', borderRadius: 8 }}>
      <div className="text-[11px]" style={{ color: '#9ca3af' }}>
        {label}
      </div>
      <div className="mt-0.5 font-bold" style={{ fontSize: 14, color: color ?? '#111827' }}>
        {value}
      </div>
      {sub && (
        <div className="text-[11px] mt-0.5" style={{ color: '#9ca3af' }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: GRAY, textDecoration: 'underline' }}>
      {children} ↗
    </a>
  );
}

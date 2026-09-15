'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Counts {
  pending_requests: number;
  pending_claims: number;
  pending_reports: number;
  total_spots: number;
}

// /api/admin/monitor 응답 중 대시보드가 쓰는 부분만
interface MonitorLite {
  stores: {
    spot_id: string;
    name: string;
    mode: 'plugin' | 'openapi';
    plugin: { alive: boolean; last_seen_age_sec: number | null; version: string | null };
    orders: { today: number; stuck: unknown[] };
  }[];
  scraper: { ok: boolean; age_sec: number | null };
}

const RED = '#dc2626';
const GREEN = '#16a34a';

function ago(sec: number | null) {
  if (sec === null) return '기록 없음';
  if (sec < 60) return `${sec}초 전`;
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return `${Math.floor(sec / 86400)}일 전`;
}

export default function AdminDashboard() {
  // 숫자 4개는 건수 전용 API(/api/admin/counts). 예전엔 목록 4개(가게 275KB 포함)를 받아 length를 셌다.
  const [counts, setCounts] = useState<Counts | 'error' | null>(null);
  const [monitor, setMonitor] = useState<MonitorLite | 'error' | null>(null);

  useEffect(() => {
    fetch('/api/admin/counts')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setCounts)
      .catch(() => setCounts('error'));
    fetch('/api/admin/monitor')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setMonitor)
      .catch(() => setMonitor('error'));
  }, []);

  const n = (k: keyof Counts) => (counts === null ? '…' : counts === 'error' ? '—' : counts[k]);
  const hi = (k: keyof Counts) => counts !== null && counts !== 'error' && counts[k] > 0;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold" style={{ color: '#111827' }}>
        대시보드
      </h1>

      {/* 운영 상태 — 문제가 있으면 여기서 바로 빨갛게. 자세한 건 /admin/monitor */}
      <section>
        <div className="flex items-baseline justify-between mb-2">
          <h2 className="font-semibold" style={{ color: '#111827', fontSize: 14 }}>
            운영 상태
          </h2>
          <Link href="/admin/monitor" className="text-xs" style={{ color: '#6b7280', textDecoration: 'underline' }}>
            모니터 열기
          </Link>
        </div>
        <div className="bg-white p-4" style={{ border: '1px solid #e5e7eb', borderRadius: 10 }}>
          {monitor === null ? (
            <div className="text-xs" style={{ color: '#9ca3af' }}>
              확인 중…
            </div>
          ) : monitor === 'error' ? (
            <div className="text-xs" style={{ color: RED }}>
              모니터 불러오기 실패
            </div>
          ) : (
            <ul className="space-y-1.5 text-xs" style={{ color: '#374151' }}>
              {monitor.stores.map((s) => {
                const pluginOk = s.mode !== 'plugin' || s.plugin.alive;
                const stuck = s.orders.stuck.length;
                return (
                  <li key={s.spot_id} className="flex items-start gap-2">
                    <Dot ok={pluginOk && stuck === 0} />
                    <span>
                      <b style={{ color: '#111827' }}>{s.name}</b> · 플러그인{' '}
                      {s.mode !== 'plugin'
                        ? '미사용(직접 전송)'
                        : s.plugin.alive
                          ? `폴링 중 (v${s.plugin.version ?? '?'})`
                          : `끊김 · 마지막 ${ago(s.plugin.last_seen_age_sec)}`}
                      {' · '}오늘 주문 {s.orders.today}건
                      {stuck > 0 && (
                        <span style={{ color: RED, fontWeight: 700 }}> · 포스 미도달 {stuck}건</span>
                      )}
                    </span>
                  </li>
                );
              })}
              <li className="flex items-start gap-2">
                <Dot ok={monitor.scraper.ok} />
                <span>
                  <b style={{ color: '#111827' }}>스크래퍼</b> ·{' '}
                  {monitor.scraper.ok ? `수집 중 (${ago(monitor.scraper.age_sec)})` : `멈춤 · 마지막 ${ago(monitor.scraper.age_sec)}`}
                </span>
              </li>
            </ul>
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat href="/admin/requests" label="대기 중 가게 요청" value={n('pending_requests')} highlight={hi('pending_requests')} />
        <Stat href="/admin/claims" label="대기 중 사장님 신청" value={n('pending_claims')} highlight={hi('pending_claims')} />
        <Stat href="/admin/reports" label="대기 중 신고" value={n('pending_reports')} highlight={hi('pending_reports')} />
        <Stat href="/admin/spots" label="등록된 가게" value={n('total_spots')} />
      </div>

      <section>
        <h2 className="font-semibold mb-2" style={{ color: '#111827', fontSize: 14 }}>
          빠른 액션
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Link
            href="/admin/requests"
            className="bg-white p-4"
            style={{ border: '1px solid #e5e7eb', borderRadius: 10, textDecoration: 'none' }}
          >
            <div style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>
              요청 처리하기
            </div>
            <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>
              이용자 제안 승인/반려
            </div>
          </Link>
          <Link
            href="/admin/spots/new"
            className="bg-white p-4"
            style={{ border: '1px solid #e5e7eb', borderRadius: 10, textDecoration: 'none' }}
          >
            <div style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>
              새 가게 등록
            </div>
            <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>
              이름·주소·좌표·인스타 직접 입력
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden
      style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, marginTop: 4, flexShrink: 0, background: ok ? GREEN : RED }}
    />
  );
}

function Stat({
  href,
  label,
  value,
  highlight,
}: {
  href: string;
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className="block p-4"
      style={{
        background: '#ffffff',
        border: highlight ? '1px solid #111827' : '1px solid #e5e7eb',
        borderRadius: 10,
        textDecoration: 'none',
      }}
    >
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>{label}</div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: highlight ? '#111827' : '#374151',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </Link>
  );
}

'use client';

import { useEffect, useState } from 'react';

type Daily = Record<string, number>;

interface GroupStat {
  key: string;
  label: string;
  adDate: string;
  spotCount: number;
  spotNames: string[];
  daily: Daily;
  beforeAvg: number;
  afterAvg: number;
  afterDays: number;
  growthPct: number | null;
  siteGrowthPct: number | null;
  control: {
    spotCount: number;
    names: string[];
    groupStoryAvg: number;
    daily: Daily;
    beforeAvg: number;
    afterAvg: number;
    growthPct: number | null;
  };
}

interface Stats {
  generatedAt: string;
  sinceDay: string;
  today: string;
  totalViews: number;
  siteDaily: Daily;
  groups: GroupStat[];
}

const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

function dayRange(d0: string, d1: string): string[] {
  const out: string[] = [];
  for (let d = d0; d <= d1; d = addDays(d, 1)) out.push(d);
  return out;
}

const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
const fPct = (n: number | null) =>
  n === null ? '—' : `${n >= 0 ? '+' : ''}${Math.round(n * 10) / 10}%`;

// 의존성 없는 일별 바 차트. adDate가 있으면 그 전/후를 색으로 구분하고
// 게재 시점에 빨간 점선을 긋는다.
function BarChart({ days, daily, adDate }: { days: string[]; daily: Daily; adDate?: string }) {
  const bw = 8;
  const gap = 2;
  const H = 120;
  const LABEL_H = 16;
  const W = days.length * (bw + gap);
  const max = Math.max(1, ...days.map((d) => daily[d] ?? 0));
  return (
    <svg viewBox={`0 0 ${W} ${H + LABEL_H}`} className="w-full h-auto" role="img">
      {days.map((d, i) => {
        const v = daily[d] ?? 0;
        const h = (v / max) * (H - 8);
        const pre = adDate ? d < adDate : false;
        return (
          <rect
            key={d}
            x={i * (bw + gap)}
            y={H - h}
            width={bw}
            height={h}
            rx={1.5}
            fill={adDate ? (pre ? '#c7d2fe' : '#6366f1') : '#111827'}
            opacity={adDate ? 1 : 0.75}
          >
            <title>{`${d}: ${v}`}</title>
          </rect>
        );
      })}
      {adDate && days.includes(adDate) && (
        <line
          x1={days.indexOf(adDate) * (bw + gap) - gap / 2}
          x2={days.indexOf(adDate) * (bw + gap) - gap / 2}
          y1={0}
          y2={H}
          stroke="#dc2626"
          strokeWidth={1.2}
          strokeDasharray="4 3"
        />
      )}
      {days.map((d, i) =>
        i % 5 === 0 ? (
          <text key={`t-${d}`} x={i * (bw + gap)} y={H + 12} fontSize={8} fill="#9ca3af">
            {d.slice(5).replace('-', '/')}
          </text>
        ) : null,
      )}
      <text x={W - 2} y={10} fontSize={8} fill="#9ca3af" textAnchor="end">
        max {max}
      </text>
    </svg>
  );
}

function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-[13px] py-1" style={{ borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ color: '#111827', fontWeight: strong ? 700 : 500 }}>{children}</span>
    </div>
  );
}

export default function ViewStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/view-stats');
        if (!res.ok) throw new Error(`불러오기 실패 (${res.status})`);
        setStats(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : '오류');
      }
    })();
  }, []);

  if (error) return <p className="text-sm" style={{ color: '#ef4444' }}>{error}</p>;
  if (!stats) return <p className="text-sm" style={{ color: '#9ca3af' }}>집계 중… (조회 로그 전체를 읽어요, 몇 초 걸립니다)</p>;

  const days = dayRange(stats.sinceDay, stats.today);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold" style={{ color: '#111827' }}>조회수 통계</h1>
        <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
          가게 상세 조회(spot_views) 기준 · {stats.sinceDay} ~ {stats.today} (KST) · 총 {stats.totalViews.toLocaleString()}회
        </p>
      </div>

      <section className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e7eb' }}>
        <h2 className="font-semibold text-sm mb-3" style={{ color: '#111827' }}>사이트 전체 · 일별</h2>
        <BarChart days={days} daily={stats.siteDaily} />
      </section>

      {stats.groups.map((g) => {
        const pending = g.afterDays < 4;
        const lift =
          !pending && g.growthPct !== null && g.control.growthPct !== null
            ? g.growthPct - g.control.growthPct
            : null;
        return (
          <section key={g.key} className="bg-white rounded-xl p-4" style={{ border: '1px solid #e5e7eb' }}>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-semibold text-sm" style={{ color: '#111827' }}>
                {g.label} <span style={{ color: '#9ca3af', fontWeight: 400 }}>· 지점 {g.spotCount}곳 · 게재 {g.adDate}</span>
              </h2>
              {pending && (
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: '#fef3c7', color: '#92400e' }}>
                  판단유보 · 게재 {g.afterDays}일
                </span>
              )}
            </div>
            <BarChart days={days} daily={g.daily} adDate={g.adDate} />
            <div className="mt-3">
              <Row label={`광고 지점 (${g.spotNames.join(', ')})`}>
                {f1(g.beforeAvg)}/일 → {f1(g.afterAvg)}/일 · {fPct(g.growthPct)}
              </Row>
              <Row label={`비교군 ${g.control.spotCount}곳 (같은 도시 · 업로드 ~${g.control.groupStoryAvg}개 유사)`}>
                {f1(g.control.beforeAvg)}/일 → {f1(g.control.afterAvg)}/일 · {fPct(g.control.growthPct)}
              </Row>
              <Row label="사이트 전체 (같은 기간)">{fPct(g.siteGrowthPct)}</Row>
              <Row label="순수 광고 효과 (광고 − 비교군)" strong>
                {lift === null ? '—' : `${lift >= 0 ? '+' : ''}${Math.round(lift * 10) / 10}%p`}
              </Row>
              <details className="mt-2">
                <summary className="text-[11px] cursor-pointer" style={{ color: '#9ca3af' }}>
                  비교군 명단 보기
                </summary>
                <p className="text-[11px] mt-1 leading-relaxed" style={{ color: '#6b7280' }}>
                  {g.control.names.join(' · ')}
                </p>
              </details>
            </div>
          </section>
        );
      })}

      <p className="text-[11px]" style={{ color: '#9ca3af' }}>
        전/후 = 게재일 기준 각 7일 평균(후 기간이 7일 미만이면 현재까지). 비교군은 광고 미게재 가게 중
        같은 도시에서 분석 기간 인스타 스토리 업로드 수가 광고 지점 평균과 가장 비슷한 곳들.
      </p>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

// 운영자 성과 대시보드 (playbook) — 북극성(혼술맵 경유 방문)과 유료화 트리거 게이지.
// 사장 리포트와 "같은 숫자"를 보는 형 쪽 화면.

interface Perf {
  northStar: { redemptions_total: number; redemptions_7d: number; visits_7d: number };
  supply: { claimed_spots: number; owners: number; benefits_active: number; chat_rooms_open: number };
  demand: { views_7d: number; favorites_total: number };
  weekly_redemptions: { week: string; count: number }[];
  top_spots: { spot_id: string; name: string; slug: string; redemptions_28d: number }[];
}

// 유료화 트리거 (playbook Phase 3): 월 리딤 100건.
const PAYWALL_TRIGGER_MONTHLY = 100;

export default function AdminPerformancePage() {
  const [data, setData] = useState<Perf | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/performance')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="text-xs" style={{ color: '#9ca3af' }}>
        불러오는 중…
      </div>
    );
  if (!data)
    return (
      <div className="text-xs" style={{ color: '#dc2626' }}>
        불러오기 실패
      </div>
    );

  const monthly = data.weekly_redemptions.reduce((s, w) => s + w.count, 0);
  const gaugePct = Math.min(100, Math.round((monthly / PAYWALL_TRIGGER_MONTHLY) * 100));
  const maxWeek = Math.max(1, ...data.weekly_redemptions.map((w) => w.count));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold" style={{ color: '#111827' }}>
          성과
        </h1>
        <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
          북극성 = 혼술맵 경유 방문(혜택 사용 + 방문 인증). 사장 리포트와 같은 숫자.
        </p>
      </div>

      {/* 북극성 */}
      <div className="grid grid-cols-3 gap-2">
        <Metric label="혜택 사용 (누적)" value={data.northStar.redemptions_total} strong />
        <Metric label="혜택 사용 (7일)" value={data.northStar.redemptions_7d} />
        <Metric label="다녀왔어요 (7일)" value={data.northStar.visits_7d} />
      </div>

      {/* 유료화 트리거 게이지 */}
      <div className="bg-white p-4" style={{ border: '1px solid #e5e7eb', borderRadius: 10 }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#111827' }}>
            유료화 트리거 — 최근 4주 리딤 {monthly} / {PAYWALL_TRIGGER_MONTHLY}건
          </span>
          <span style={{ fontSize: 12, fontWeight: 800, color: gaugePct >= 100 ? '#16a34a' : '#6b7280' }}>
            {gaugePct}%
          </span>
        </div>
        <div style={{ marginTop: 8, height: 8, background: '#f3f4f6', borderRadius: 999, overflow: 'hidden' }}>
          <div
            style={{ width: `${gaugePct}%`, height: '100%', background: gaugePct >= 100 ? '#16a34a' : '#111827', borderRadius: 999, transition: 'width .3s' }}
          />
        </div>
        {gaugePct >= 100 && (
          <p style={{ fontSize: 11.5, color: '#16a34a', fontWeight: 700, marginTop: 6 }}>
            트리거 도달 — Phase 3 (유료화 준비) 시작 조건 충족!
          </p>
        )}
      </div>

      {/* 주별 리딤 미니 차트 */}
      <div className="bg-white p-4" style={{ border: '1px solid #e5e7eb', borderRadius: 10 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111827', marginBottom: 10 }}>주별 혜택 사용</div>
        <div className="flex items-end gap-3" style={{ height: 90 }}>
          {data.weekly_redemptions.map((w) => (
            <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
              <span style={{ fontSize: 11, fontWeight: 700, color: '#111827' }}>{w.count}</span>
              <div
                style={{ width: '100%', maxWidth: 44, height: Math.max(4, (w.count / maxWeek) * 56), background: '#111827', borderRadius: 6 }}
              />
              <span style={{ fontSize: 10, color: '#9ca3af' }}>{w.week}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 공급/수요 현황 */}
      <div className="grid grid-cols-3 gap-2">
        <Metric label="인증 가게" value={data.supply.claimed_spots} />
        <Metric label="사장 계정" value={data.supply.owners} />
        <Metric label="활성 혜택" value={data.supply.benefits_active} />
        <Metric label="채팅방 열림" value={data.supply.chat_rooms_open} />
        <Metric label="조회 (7일)" value={data.demand.views_7d} />
        <Metric label="찜 (누적)" value={data.demand.favorites_total} />
      </div>

      {/* 가게별 기여 */}
      <div className="bg-white" style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 14px', fontSize: 12.5, fontWeight: 700, color: '#111827', borderBottom: '1px solid #f3f4f6' }}>
          가게별 혜택 사용 (최근 4주)
        </div>
        {data.top_spots.length === 0 ? (
          <div className="p-5 text-center text-xs" style={{ color: '#9ca3af' }}>
            아직 리딤이 없어요 — 혜택 등록 가게가 생기면 여기 쌓입니다
          </div>
        ) : (
          <table className="w-full text-xs">
            <tbody>
              {data.top_spots.map((s, i) => (
                <tr key={s.spot_id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                  <td className="px-3 py-2" style={{ color: '#9ca3af', width: 30 }}>{i + 1}</td>
                  <td className="px-1 py-2" style={{ color: '#111827', fontWeight: 600 }}>
                    <a href={`/spot/${s.slug}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
                      {s.name}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-right" style={{ color: '#111827', fontWeight: 700 }}>
                    {s.redemptions_28d}건
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="bg-white p-3" style={{ border: '1px solid #e5e7eb', borderRadius: 10 }}>
      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: strong ? 24 : 20, fontWeight: 800, color: strong ? '#ea580c' : '#111827', marginTop: 2, letterSpacing: '-0.5px' }}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}

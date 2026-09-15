'use client';

// 가게 분석 (CRM) — /partner/spot/[id]/insights.
// 가게 통계 페이지의 형제 서브탭. 이미 수집 중인 데이터만 집계해 보여준다.
// (새 수집이 필요한 지표는 로드맵 — 여기 없음.) AuthGate 안, PartnerShell 1040 컬럼.

import { Fragment, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AuthGate from '../../../AuthGate';
import { Card, PageHeader, Spinner, buttonStyle, ACCENT } from '../../../ui';

const INK = '#111827';
const SUB = '#6b7280';
const MUTED = '#9ca3af';
const BORDER = '#e5e7eb';
const SOFT = '#eff6ff';

interface Insights {
  name: string | null;
  updatedThru: string | null;
  hasData: boolean;
  live: { active: number; seats: number; status: string | null };
  kpi: {
    visitors7: number;
    visitorsPrev7: number;
    revenue7: number;
    revenuePrev7: number;
    avgTicket: number;
    repeatRate: number | null;
  };
  daily: { day: string; visitors: number; revenue: number; orders: number }[];
  demographics: { gender: Record<string, number>; age: Record<string, number> };
  disposition: { purpose: Record<string, number>; vibe: Record<string, number> };
  heatmap: number[][];
  segments: { new: number; active: number; atRisk: number; dormant: number; vip: number };
  customers: {
    key: string;
    linked: boolean;
    segment: string;
    visits: number;
    lastDays: number;
    total: number;
  }[];
  menu: { name: string; qty: number; revenue: number }[];
  attribution: { redemptions: number; redemptions7: number; favorites: number; views30: number };
}

const SEG: Record<string, { emoji: string; name: string; color: string; bg: string }> = {
  new: { emoji: '🌱', name: '신규', color: '#1d4ed8', bg: SOFT },
  active: { emoji: '🔥', name: '활성 단골', color: '#15803d', bg: '#dcfce7' },
  atRisk: { emoji: '⚠️', name: '이탈 위험', color: '#b45309', bg: '#fef3c7' },
  dormant: { emoji: '💤', name: '휴면', color: '#4b5563', bg: '#f3f4f6' },
  vip: { emoji: '👑', name: 'VIP', color: '#7c3aed', bg: '#ede9fe' },
};
const SEG_DESC: Record<string, string> = {
  new: '이번 달 첫 방문',
  active: '2주 내 재방문·2회+',
  atRisk: '평소 주기 넘겨 안 옴',
  dormant: '30일+ 무방문',
  vip: '누적 매출 상위 10%',
};
const LIVE_LABEL: Record<string, string> = {
  ready: '오픈 준비',
  open: '영업 중',
  busy: '빠르게 차는 중',
  full: '만석',
  closed: '휴무',
};
const GENDER_LABEL: Record<string, string> = { m: '남', f: '여' };

const won = (n: number) => `₩${Math.round(n).toLocaleString()}`;
const wonShort = (n: number) => (n >= 1_000_000 ? `₩${(n / 1_000_000).toFixed(2)}M` : won(n));
const deltaPct = (cur: number, prev: number): number | null =>
  prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
const topEntries = (t: Record<string, number>, n = 5) =>
  Object.entries(t)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
const sumVals = (t: Record<string, number>) => Object.values(t).reduce((a, v) => a + v, 0);

const sectionLabel: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: INK,
  letterSpacing: '-0.3px',
  marginBottom: 10,
};

function Delta({ v, suffix = '%' }: { v: number | null; suffix?: string }) {
  if (v === null) return <span style={{ fontSize: 11.5, color: MUTED, fontWeight: 600 }}>—</span>;
  const up = v >= 0;
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 800,
        color: up ? '#16a34a' : '#dc2626',
        background: up ? '#dcfce7' : '#fee2e2',
        padding: '2px 7px',
        borderRadius: 999,
      }}
    >
      {up ? '▲' : '▼'} {Math.abs(v)}
      {suffix} <span style={{ color: MUTED, fontWeight: 600 }}>전주</span>
    </span>
  );
}

function StatCard({
  label,
  value,
  unit,
  delta,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: number | null;
}) {
  return (
    <Card style={{ padding: '13px 15px' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: SUB }}>{label}</div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 820,
          color: INK,
          letterSpacing: '-1px',
          marginTop: 5,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
        {unit && <span style={{ fontSize: 13, fontWeight: 700, color: SUB }}> {unit}</span>}
      </div>
      {delta !== undefined && (
        <div style={{ marginTop: 8 }}>
          <Delta v={delta} suffix={label === '재방문율' ? '%p' : '%'} />
        </div>
      )}
    </Card>
  );
}

function BarRow({ label, value, max, right }: { label: string; value: number; max: number; right: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr auto', alignItems: 'center', gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: INK, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </div>
      <div style={{ height: 20, background: '#f8f9fa', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${max > 0 ? (value / max) * 100 : 0}%`, background: ACCENT, borderRadius: 6 }} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: SUB, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{right}</div>
    </div>
  );
}

function MiniBars({ tally }: { tally: Record<string, number> }) {
  const total = sumVals(tally);
  const rows = topEntries(tally, 4);
  if (!rows.length) return <p style={{ fontSize: 12, color: MUTED }}>아직 데이터가 없어요.</p>;
  const max = rows[0][1];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(([k, v]) => (
        <div key={k}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
            <span style={{ fontWeight: 700, color: INK }}>{k}</span>
            <span style={{ color: SUB, fontVariantNumeric: 'tabular-nums' }}>
              {total > 0 ? Math.round((v / total) * 100) : 0}%
            </span>
          </div>
          <div style={{ height: 8, background: '#f8f9fa', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${max > 0 ? (v / max) * 100 : 0}%`, background: ACCENT, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function InsightsContent() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/partner/spots/${id}/insights`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setErr(j.error || '불러오지 못했어요.');
          return;
        }
        setD(await res.json());
      } catch {
        setErr('네트워크 오류로 불러오지 못했어요.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const backBtn = (
    <Link href={`/partner/spot/${id}`} style={{ ...buttonStyle('outline'), height: 40, padding: '0 14px', fontSize: 13 }}>
      ← 가게 통계
    </Link>
  );

  if (loading) return <Spinner label="분석 불러오는 중…" />;
  if (err || !d)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <PageHeader title="가게 분석" action={backBtn} />
        <Card style={{ padding: '40px 24px', textAlign: 'center' }}>
          <p style={{ color: SUB, fontSize: 13.5 }}>{err ?? '데이터를 불러오지 못했어요.'}</p>
        </Card>
      </div>
    );

  const k = d.kpi;
  const maxVisit = Math.max(1, ...d.daily.map((x) => x.visitors));
  const heatMax = Math.max(1, ...d.heatmap.flat());
  const menuMax = Math.max(1, ...d.menu.map((m) => m.qty));
  const genderTotal = sumVals(d.demographics.gender);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="가게 분석"
        subtitle={`${d.name ?? '우리 가게'} · 최근 30일 · 영업 마감 집계 기준`}
        action={backBtn}
      />

      {!d.hasData ? (
        <Card style={{ padding: '44px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 30 }}>📊</div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: INK, marginTop: 10 }}>아직 분석할 데이터가 적어요</h2>
          <p style={{ color: SUB, fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
            테이블 서비스로 손님 체크인·주문이 쌓이면
            <br />방문·매출·단골 분석이 여기에 자동으로 채워져요.
          </p>
        </Card>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 10 }}>
            <StatCard label="방문 손님 (7일)" value={k.visitors7.toLocaleString()} unit="명" delta={deltaPct(k.visitors7, k.visitorsPrev7)} />
            <StatCard label="매출 (7일)" value={wonShort(k.revenue7)} delta={deltaPct(k.revenue7, k.revenuePrev7)} />
            <StatCard label="객단가" value={won(k.avgTicket)} />
            <StatCard label="재방문율" value={k.repeatRate === null ? '—' : String(k.repeatRate)} unit={k.repeatRate === null ? undefined : '%'} />
          </div>

          {/* 방문 추이 + 실시간 */}
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 12 }}>
            <Card style={{ padding: '15px 16px' }} className="md:col-span-2">
              <div style={sectionLabel}>방문 추이 <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>· 최근 {d.daily.length}영업일</span></div>
              {d.daily.length ? (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
                  {d.daily.map((x, i) => (
                    <div
                      key={i}
                      title={`${new Date(x.day).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })} · ${x.visitors}명 · ${won(x.revenue)}`}
                      style={{
                        flex: 1,
                        height: `${Math.max(4, (x.visitors / maxVisit) * 100)}%`,
                        background: i === d.daily.length - 1 ? ACCENT : '#c9dbfa',
                        borderRadius: '4px 4px 0 0',
                        minWidth: 6,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: MUTED }}>마감 집계가 아직 없어요.</p>
              )}
            </Card>
            <Card style={{ padding: '15px 16px' }}>
              <div style={sectionLabel}>실시간 현황</div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#1d4ed8',
                  background: SOFT,
                  padding: '5px 10px',
                  borderRadius: 999,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: 999, background: ACCENT }} />
                {d.live.status ? LIVE_LABEL[d.live.status] ?? d.live.status : '상태 미설정'}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12 }}>
                <span style={{ fontSize: 28, fontWeight: 820, color: INK, letterSpacing: '-1px', fontVariantNumeric: 'tabular-nums' }}>
                  {d.live.active}
                </span>
                <span style={{ fontSize: 13, color: SUB, fontWeight: 700 }}>/ {d.live.seats}석 사용 중</span>
              </div>
              <div style={{ height: 9, borderRadius: 999, background: '#f3f4f6', overflow: 'hidden', marginTop: 10 }}>
                <div style={{ height: '100%', width: `${d.live.seats > 0 ? Math.min(100, (d.live.active / d.live.seats) * 100) : 0}%`, background: ACCENT, borderRadius: 999 }} />
              </div>
            </Card>
          </div>

          {/* 세그먼트 */}
          <div>
            <div style={sectionLabel}>고객 세그먼트 <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>· RFM · 최근 60일</span></div>
            <div className="grid grid-cols-2 md:grid-cols-5" style={{ gap: 10 }}>
              {(['new', 'active', 'atRisk', 'dormant', 'vip'] as const).map((key) => {
                const m = SEG[key];
                return (
                  <Card key={key} style={{ padding: '12px 14px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: m.color }} />
                    <div style={{ fontSize: 12, fontWeight: 800, color: INK, paddingLeft: 4 }}>
                      {m.emoji} {m.name}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 820, color: INK, letterSpacing: '-0.8px', marginTop: 3, paddingLeft: 4, fontVariantNumeric: 'tabular-nums' }}>
                      {d.segments[key]}
                      <span style={{ fontSize: 12, fontWeight: 700, color: SUB }}> 명</span>
                    </div>
                    <div style={{ fontSize: 11, color: SUB, marginTop: 5, paddingLeft: 4, lineHeight: 1.4 }}>{SEG_DESC[key]}</div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* 구성 · 성향 · 시간대 */}
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 12 }}>
            <Card style={{ padding: '15px 16px' }}>
              <div style={sectionLabel}>고객 구성 <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>· 성별·연령</span></div>
              {genderTotal > 0 ? (
                <>
                  <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', marginBottom: 6 }}>
                    {topEntries(d.demographics.gender, 3).map(([g, v]) => (
                      <div
                        key={g}
                        title={`${GENDER_LABEL[g] ?? g} ${v}명`}
                        style={{
                          width: `${(v / genderTotal) * 100}%`,
                          background: g === 'm' ? ACCENT : g === 'f' ? '#f59e0b' : '#cbd5e1',
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 14, fontSize: 11.5, fontWeight: 700, color: INK, marginBottom: 12 }}>
                    {topEntries(d.demographics.gender, 3).map(([g, v]) => (
                      <span key={g} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 9, height: 9, borderRadius: 2, background: g === 'm' ? ACCENT : g === 'f' ? '#f59e0b' : '#cbd5e1' }} />
                        {GENDER_LABEL[g] ?? g} <span style={{ color: SUB, fontWeight: 600 }}>{Math.round((v / genderTotal) * 100)}%</span>
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p style={{ fontSize: 12, color: MUTED, marginBottom: 12 }}>성별 데이터가 아직 없어요.</p>
              )}
              <MiniBars tally={d.demographics.age} />
            </Card>

            <Card style={{ padding: '15px 16px' }}>
              <div style={sectionLabel}>방문 성향 <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>· 목적·분위기</span></div>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: SUB, marginBottom: 8 }}>방문 목적</div>
              <MiniBars tally={d.disposition.purpose} />
              <div style={{ fontSize: 10.5, fontWeight: 800, color: SUB, margin: '14px 0 8px' }}>분위기</div>
              <MiniBars tally={d.disposition.vibe} />
            </Card>

            <Card style={{ padding: '15px 16px' }}>
              <div style={sectionLabel}>시간대 분석 <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>· 요일×시간</span></div>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '22px repeat(6, 1fr)', gap: 3, minWidth: 260 }}>
                  <div />
                  {['17', '19', '21', '23', '1시', '늦게'].map((c) => (
                    <div key={c} style={{ fontSize: 9, color: MUTED, textAlign: 'center' }}>{c}</div>
                  ))}
                  {['월', '화', '수', '목', '금', '토', '일'].map((dy, r) => (
                    <Fragment key={r}>
                      <div style={{ fontSize: 10, color: SUB, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{dy}</div>
                      {d.heatmap[r].map((v, c) => {
                        const t = v / heatMax;
                        return (
                          <div
                            key={`${r}-${c}`}
                            title={`${dy} ${v}명`}
                            style={{
                              height: 20,
                              borderRadius: 4,
                              background: v === 0 ? '#f8f9fa' : `rgba(37,99,235,${0.12 + t * 0.8})`,
                            }}
                          />
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* 메뉴 + 유입 */}
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 12 }}>
            <Card style={{ padding: '15px 16px' }}>
              <div style={sectionLabel}>메뉴 분석 <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>· 수량·매출 TOP</span></div>
              {d.menu.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {d.menu.map((m) => (
                    <BarRow key={m.name} label={m.name} value={m.qty} max={menuMax} right={`${m.qty} · ${wonShort(m.revenue)}`} />
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: MUTED }}>주문 데이터가 아직 없어요.</p>
              )}
            </Card>

            <Card style={{ padding: '15px 16px' }}>
              <div style={sectionLabel}>혼술맵 유입 기여 <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>· 방문 전→귀속</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                {[
                  { k: '혜택 사용 (GPS/PIN 인증)', v: `${d.attribution.redemptions}건`, sub: `이번 주 ${d.attribution.redemptions7}건`, c: INK },
                  { k: '찜한 손님 (푸시 대상)', v: `${d.attribution.favorites}명`, sub: '새 소식 발송 가능', c: '#7c3aed' },
                  { k: '지도·가게 조회 (30일)', v: `${d.attribution.views30.toLocaleString()}회`, sub: '방문 전 관심 · 익명 집계', c: INK },
                ].map((x) => (
                  <div key={x.k} style={{ background: '#f8f9fa', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '11px 13px' }}>
                    <div style={{ fontSize: 11, color: SUB, fontWeight: 700 }}>{x.k}</div>
                    <div style={{ fontSize: 19, fontWeight: 820, color: x.c, letterSpacing: '-0.5px', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{x.v}</div>
                    <div style={{ fontSize: 10.5, color: MUTED, marginTop: 1 }}>{x.sub}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* 고객 리스트 */}
          <Card style={{ padding: '15px 16px' }}>
            <div style={sectionLabel}>고객 리스트 <span style={{ fontSize: 11, fontWeight: 600, color: MUTED }}>· 최근 방문 순 · 익명 기기키</span></div>
            {d.customers.length ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
                  <thead>
                    <tr>
                      {['손님', '세그먼트', '방문', '마지막', '누적 주문'].map((h) => (
                        <th key={h} style={{ fontSize: 10.5, fontWeight: 800, color: MUTED, textAlign: 'left', padding: '0 10px 9px', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {d.customers.map((c) => {
                      const m = SEG[c.segment] ?? SEG.new;
                      return (
                        <tr key={c.key + c.lastDays}>
                          <td style={{ padding: '10px', borderTop: `1px solid ${BORDER}`, fontSize: 12.5 }}>
                            <span style={{ fontWeight: 800, color: INK }}>손님 #{c.key}</span>
                            {c.linked && <span style={{ fontSize: 10.5, color: '#1d4ed8', marginLeft: 6, fontWeight: 700 }}>· 로그인</span>}
                          </td>
                          <td style={{ padding: '10px', borderTop: `1px solid ${BORDER}` }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: m.color, background: m.bg, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                              {m.emoji} {m.name}
                            </span>
                          </td>
                          <td style={{ padding: '10px', borderTop: `1px solid ${BORDER}`, fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{c.visits}회</td>
                          <td style={{ padding: '10px', borderTop: `1px solid ${BORDER}`, fontSize: 12.5, color: SUB, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                            {c.lastDays === 0 ? '오늘' : `${c.lastDays}일 전`}
                          </td>
                          <td style={{ padding: '10px', borderTop: `1px solid ${BORDER}`, fontSize: 12.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{won(c.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: MUTED }}>체크인한 손님이 아직 없어요.</p>
            )}
          </Card>

          <p style={{ fontSize: 11, color: MUTED, lineHeight: 1.6, padding: '4px 2px' }}>
            지금 수집 중인 데이터로 집계 — 손님 신원은 익명 기기키 기반(개인정보 미노출). 실결제·체류시간·유입경로 등은
            데이터 확장 로드맵 대상.
          </p>
        </>
      )}
    </div>
  );
}

export default function InsightsPage() {
  return (
    <AuthGate>
      <InsightsContent />
    </AuthGate>
  );
}

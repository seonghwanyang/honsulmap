'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AuthGate from '../../AuthGate';
import { Card, Chip, PageHeader, Spinner, buttonStyle } from '../../ui';
import { track } from '@/lib/analytics';
import ChatRoom from '@/components/chat/ChatRoom';
import NoticeBanner from '@/components/partner/NoticeBanner';

interface RankInfo {
  rank: number;
  topPct: number;
}
interface CohortRanks {
  views: RankInfo;
  likes: RankInfo;
  visits: RankInfo;
}
interface StatsData {
  region: { name: string; label: string; size: number; ranks: CohortRanks | null };
  national: { label: string; size: number; ranks: CohortRanks | null };
  trend: { views7d: number; prev7d: number; pct: number | null };
  redemptions: { total: number; d7: number };
}

interface ChatReport {
  id: string;
  message_id: string;
  reason: string;
  detail: string | null;
  created_at: string;
  body: string | null;
  nickname: string;
  deleted: boolean;
}

const REPORT_REASON: Record<string, string> = {
  spam: '스팸·광고',
  abuse: '욕설·비방',
  illegal: '불법·음란',
  other: '기타',
};

interface SpotData {
  role: 'owner' | 'manager';
  spot: {
    id: string;
    name: string;
    slug: string;
    region: string;
    category: string;
    instagram_id: string | null;
    memo: string | null;
    business_hours: string | null;
    phone: string | null;
    vip_until: string | null;
    benefit_title: string | null;
    benefit_detail: string | null;
    benefit_active: boolean;
    benefit_expires_at: string | null;
    redeem_pin: string | null;
  };
  stats: { views: number; visits: number; likes: number; mood_up: number; mood_down: number };
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 46,
  padding: '0 14px',
  borderRadius: 11,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#111827',
  fontSize: 14,
  outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12.5,
  fontWeight: 700,
  color: '#374151',
  marginBottom: 7,
  letterSpacing: '-0.2px',
};
const sectionLabel: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#6b7280',
  letterSpacing: '0.2px',
  margin: '0 2px 10px',
};

function isVip(until: string | null) {
  return !!until && new Date(until).getTime() > Date.now();
}

function RankCard({
  label,
  regionName,
  regionSize,
  region,
  nationalSize,
  national,
}: {
  label: string;
  regionName: string;
  regionSize: number;
  region: RankInfo;
  nationalSize: number;
  national: RankInfo | null;
}) {
  return (
    <Card style={{ padding: '13px 12px' }}>
      <div style={{ fontSize: 11.5, color: '#6b7280', fontWeight: 600, letterSpacing: '-0.1px' }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: '#111827', marginTop: 5, letterSpacing: '-0.3px', lineHeight: 1.3 }}>
        {regionName} {regionSize}곳 중 {region.rank}위
      </div>
      {national && (
        <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 3, lineHeight: 1.3 }}>
          전국 {nationalSize}곳 중 {national.rank}위
        </div>
      )}
    </Card>
  );
}

function SpotManageContent() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<SpotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [memo, setMemo] = useState('');
  const [hours, setHours] = useState('');
  const [phone, setPhone] = useState('');
  const [benefitTitle, setBenefitTitle] = useState('');
  const [benefitDetail, setBenefitDetail] = useState('');
  const [benefitActive, setBenefitActive] = useState(false);
  const [benefitDuration, setBenefitDuration] = useState<
    'forever' | '1h' | '1d' | '1w' | '1m' | 'custom'
  >('forever');
  const [benefitCustom, setBenefitCustom] = useState('');
  const [redeemPin, setRedeemPin] = useState('');
  const [savingBenefit, setSavingBenefit] = useState(false);
  const [benefitMsg, setBenefitMsg] = useState('');
  const [benefitErr, setBenefitErr] = useState('');
  // 채팅방(#6) 관리 상태
  const [chatRoom, setChatRoom] = useState<{ is_open: boolean; notice: string | null } | null>(null);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatNotice, setChatNotice] = useState('');
  const [chatMsgCount, setChatMsgCount] = useState(0);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [chatErr, setChatErr] = useState('');
  const [chatReports, setChatReports] = useState<ChatReport[]>([]);
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [chatVersion, setChatVersion] = useState(0); // 삭제 후 임베드 채팅 재마운트용
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/partner/spots/${id}`)
      .then(async (r) => {
        if (r.status === 403) {
          setForbidden(true);
          return null;
        }
        return r.ok ? ((await r.json()) as SpotData) : null;
      })
      .then((d) => {
        if (d) {
          setData(d);
          setMemo(d.spot.memo ?? '');
          setHours(d.spot.business_hours ?? '');
          setPhone(d.spot.phone ?? '');
          setBenefitTitle(d.spot.benefit_title ?? '');
          setBenefitDetail(d.spot.benefit_detail ?? '');
          setBenefitActive(!!d.spot.benefit_active);
          setRedeemPin(d.spot.redeem_pin ?? '');
          if (d.spot.benefit_expires_at) {
            setBenefitDuration('custom');
            setBenefitCustom(d.spot.benefit_expires_at.slice(0, 16));
          } else {
            setBenefitDuration('forever');
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  // 채팅방 현황 로드 — 미개설/열림/닫힘 분기 + 공지/메시지 수.
  useEffect(() => {
    fetch(`/api/chat/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setChatRoom(d.room ?? null);
        setChatOpen(!!d.room?.is_open);
        setChatNotice(d.room?.notice ?? '');
        setChatMsgCount(d.message_count ?? 0);
      })
      .catch(() => {})
      .finally(() => setChatLoaded(true));
  }, [id]);

  const loadChatReports = useCallback(() => {
    fetch(`/api/partner/spots/${id}/chat-reports`)
      .then((r) => (r.ok ? r.json() : { reports: [] }))
      .then((d) => setChatReports(d.reports ?? []))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    loadChatReports();
  }, [loadChatReports]);

  useEffect(() => {
    fetch(`/api/partner/spots/${id}/stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStatsData(d))
      .catch(() => {});
  }, [id]);

  const deleteReported = async (messageId: string) => {
    if (typeof window !== 'undefined' && !window.confirm('이 메시지를 삭제할까요?')) return;
    const res = await fetch(`/api/chat/${id}/messages/${messageId}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('삭제에 실패했어요.');
      return;
    }
    setChatVersion((v) => v + 1); // 임베드 채팅 재마운트 → 삭제 즉시 반영
    loadChatReports();
  };

  const openChat = async () => {
    setChatBusy(true);
    setChatErr('');
    setChatMsg('');
    try {
      const res = await fetch(`/api/chat/${id}`, { method: 'POST' });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error || '개설에 실패했어요.');
      setChatRoom(b.room);
      setChatOpen(!!b.room.is_open);
      setChatNotice(b.room.notice ?? '');
      setChatMsg('채팅방이 개설됐어요. 지도 가게 화면에 채팅 버튼이 표시돼요.');
    } catch (e) {
      setChatErr((e as Error).message);
    } finally {
      setChatBusy(false);
    }
  };

  const saveChat = async () => {
    setChatBusy(true);
    setChatErr('');
    setChatMsg('');
    try {
      const res = await fetch(`/api/chat/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_open: chatOpen, notice: chatNotice }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error || '저장에 실패했어요.');
      setChatRoom(b.room);
      setChatMsg(chatOpen ? '저장됐어요. 채팅방이 열려 있어요.' : '저장됐어요. 채팅방을 닫았어요.');
    } catch (e) {
      setChatErr((e as Error).message);
    } finally {
      setChatBusy(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setSavedMsg('');
    try {
      const res = await fetch(`/api/partner/spots/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo, business_hours: hours, phone }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || '저장에 실패했어요.');
      }
      setSavedMsg('저장됐어요.');
      track('partner_spot_managed', { spot_id: id });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const saveBenefit = async () => {
    if (benefitActive && !benefitTitle.trim()) {
      setBenefitMsg('');
      setBenefitErr('혜택을 켜려면 제목을 입력해주세요.');
      return;
    }
    setSavingBenefit(true);
    setBenefitErr('');
    setBenefitMsg('');
    let benefit_expires_at: string | null = null;
    if (benefitDuration === '1h') benefit_expires_at = new Date(Date.now() + 3600e3).toISOString();
    else if (benefitDuration === '1d') benefit_expires_at = new Date(Date.now() + 86400e3).toISOString();
    else if (benefitDuration === '1w') benefit_expires_at = new Date(Date.now() + 7 * 86400e3).toISOString();
    else if (benefitDuration === '1m') benefit_expires_at = new Date(Date.now() + 30 * 86400e3).toISOString();
    else if (benefitDuration === 'custom')
      benefit_expires_at = benefitCustom ? new Date(benefitCustom).toISOString() : null;
    try {
      const res = await fetch(`/api/partner/spots/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benefit_title: benefitTitle,
          benefit_detail: benefitDetail,
          benefit_active: benefitActive,
          benefit_expires_at,
          redeem_pin: redeemPin,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || '저장에 실패했어요.');
      }
      setBenefitMsg(
        benefitActive
          ? '혜택이 저장됐어요. 지도·상세에 표시돼요.'
          : '저장됐어요. 단, 위 "혜택 노출"을 켜야 지도·상세에 보여요.',
      );
    } catch (e) {
      setBenefitErr((e as Error).message);
    } finally {
      setSavingBenefit(false);
    }
  };

  if (loading) {
    return <Spinner />;
  }

  if (forbidden || !data) {
    return (
      <Card style={{ padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>
          {forbidden ? '이 가게를 관리할 권한이 없어요.' : '가게 정보를 불러오지 못했어요.'}
        </p>
        <Link href="/partner/dashboard" style={{ ...buttonStyle('outline'), marginTop: 18 }}>
          대시보드로
        </Link>
      </Card>
    );
  }

  const { spot } = data;
  const trend = statsData?.trend;
  let trendText = '—';
  let trendColor = '#111827';
  if (trend) {
    if (trend.pct != null) {
      trendText = `${trend.pct > 0 ? '▲' : trend.pct < 0 ? '▼' : ''}${Math.abs(trend.pct)}%`;
      trendColor = trend.pct > 0 ? '#16a34a' : trend.pct < 0 ? '#dc2626' : '#111827';
    } else if (trend.views7d > 0) {
      trendText = '새로 집계 중';
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <NoticeBanner />
      <PageHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {spot.name}
            {isVip(spot.vip_until) && <Chip tone="vip">★ VIP</Chip>}
          </span>
        }
        subtitle={`${spot.region} · ${spot.category === 'guesthouse' ? '게스트하우스' : '혼술바'}${
          spot.instagram_id ? ` · @${spot.instagram_id}` : ''
        }`}
        action={
          <Link href="/partner/dashboard" style={buttonStyle('outline')}>
            ← 대시보드
          </Link>
        }
      />

      {/* 통계 — 상대평가(상위%) + 주간 추세 */}
      <section>
        <h2 style={sectionLabel}>통계</h2>
        {!statsData ? (
          <Card style={{ padding: 16 }}>
            <p style={{ fontSize: 12.5, color: '#9ca3af' }}>불러오는 중…</p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {statsData.region.ranks ? (
              <>
                <div className="grid grid-cols-3" style={{ gap: 10 }}>
                  <RankCard label="조회수" regionName={statsData.region.name} regionSize={statsData.region.size} region={statsData.region.ranks.views} nationalSize={statsData.national.size} national={statsData.national.ranks?.views ?? null} />
                  <RankCard label="좋아요" regionName={statsData.region.name} regionSize={statsData.region.size} region={statsData.region.ranks.likes} nationalSize={statsData.national.size} national={statsData.national.ranks?.likes ?? null} />
                  <RankCard label="다녀왔어요" regionName={statsData.region.name} regionSize={statsData.region.size} region={statsData.region.ranks.visits} nationalSize={statsData.national.size} national={statsData.national.ranks?.visits ?? null} />
                </div>
                <p style={{ fontSize: 11, color: '#9ca3af', padding: '0 2px', lineHeight: 1.5 }}>
                  {statsData.region.label} 기준. 조회수는 방문자가 가게 화면을 연 횟수.
                </p>
              </>
            ) : (
              <Card style={{ padding: 16 }}>
                <p style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.6 }}>
                  {statsData.region.label} 가게가 아직 적어 순위를 낼 수 없어요. 데이터가 더 쌓이면 순위를 보여드릴게요.
                </p>
              </Card>
            )}
            <div className="grid grid-cols-2" style={{ gap: 10 }}>
              <Card style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 11.5, color: '#6b7280', fontWeight: 600 }}>이번 주 조회 추세</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, letterSpacing: '-0.5px', color: trendColor }}>
                  {trendText}
                </div>
              </Card>
              {/* 혜택 사용 = "혼술맵이 보낸 손님" — 어트리뷰션 카운터 (playbook) */}
              <Card style={{ padding: '14px 16px' }}>
                <div style={{ fontSize: 11.5, color: '#6b7280', fontWeight: 600 }}>혜택 사용 (방문 인증)</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4, letterSpacing: '-0.5px', color: '#111827' }}>
                  {statsData.redemptions.total}건
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>이번 주 {statsData.redemptions.d7}건</div>
              </Card>
            </div>
          </div>
        )}
      </section>

      {/* 혜택 */}
      <section>
        <h2 style={sectionLabel}>혜택</h2>
        <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>혜택 노출</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, lineHeight: 1.5 }}>
                켜면 지도 마커와 가게 상세에 🎁 혜택이 표시돼요.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBenefitActive((v) => !v)}
              aria-pressed={benefitActive}
              aria-label="혜택 노출"
              style={{ flexShrink: 0, width: 46, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative', background: benefitActive ? '#111827' : '#d1d5db', transition: 'background .15s' }}
            >
              <span style={{ position: 'absolute', top: 3, left: benefitActive ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
            </button>
          </div>
          <div>
            <label style={labelStyle}>혜택 제목</label>
            <input
              value={benefitTitle}
              onChange={(e) => {
                setBenefitTitle(e.target.value);
                if (e.target.value.trim() && !benefitActive) setBenefitActive(true);
              }}
              maxLength={40}
              placeholder="예) 웰컴 드링크 1잔 서비스"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>조건·설명 (선택)</label>
            <input
              value={benefitDetail}
              onChange={(e) => setBenefitDetail(e.target.value)}
              maxLength={200}
              placeholder="예) 방문 1회 한정 · 첫 주문 시"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>노출 기간</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {(
                [
                  ['forever', '상시'],
                  ['1h', '1시간'],
                  ['1d', '하루'],
                  ['1w', '일주일'],
                  ['1m', '한달'],
                  ['custom', '직접 설정'],
                ] as const
              ).map(([val, lbl]) => {
                const on = benefitDuration === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setBenefitDuration(val)}
                    style={{
                      padding: '7px 13px',
                      borderRadius: 999,
                      border: `1px solid ${on ? '#ea580c' : '#e5e7eb'}`,
                      background: on ? '#ea580c' : '#fff',
                      color: on ? '#fff' : '#374151',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      lineHeight: 1,
                      letterSpacing: '-0.2px',
                    }}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
            {benefitDuration === 'custom' && (
              <input
                type="datetime-local"
                value={benefitCustom}
                onChange={(e) => setBenefitCustom(e.target.value)}
                style={{ ...inputStyle, marginTop: 10 }}
              />
            )}
            <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 8 }}>
              현재:{' '}
              {spot.benefit_expires_at
                ? `${spot.benefit_expires_at.slice(0, 10)} ${spot.benefit_expires_at.slice(11, 16)} 까지`
                : '상시'}
            </div>
          </div>
          {/* 리딤 PIN — 가게측 최종 승인(악용 방지). 비우면 GPS 확인만으로 사용 처리. */}
          <div>
            <label style={labelStyle}>사용 확인 PIN (선택)</label>
            <input
              value={redeemPin}
              onChange={(e) => setRedeemPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              placeholder="숫자 4자리 (예: 1234)"
              style={inputStyle}
            />
            <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 6, lineHeight: 1.5 }}>
              설정하면 손님이 혜택을 쓸 때 직원이 이 PIN을 입력해야 처리돼요 (중복·허위 사용 방지).
              비워두면 위치(가게 300m) 확인만으로 처리돼요.
            </div>
          </div>
          {benefitErr && <p style={{ color: '#ef4444', fontSize: 12.5 }}>{benefitErr}</p>}
          {benefitMsg && <p style={{ color: '#16a34a', fontSize: 12.5, fontWeight: 600 }}>{benefitMsg}</p>}
          <button
            onClick={saveBenefit}
            disabled={savingBenefit}
            style={{ ...buttonStyle('primary', { disabled: savingBenefit }), alignSelf: 'flex-start' }}
          >
            {savingBenefit ? '저장 중…' : '혜택 저장'}
          </button>
        </Card>
      </section>

      {/* 채팅방 */}
      <section>
        <h2 style={sectionLabel}>채팅방</h2>
        <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!chatLoaded ? (
            <p style={{ fontSize: 12.5, color: '#9ca3af' }}>불러오는 중…</p>
          ) : !chatRoom ? (
            <>
              <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                채팅방을 열면 방문자가 가게에 직접 메시지를 남길 수 있어요. 개설하면 지도 가게 화면에 채팅
                버튼이 떠요.
              </p>
              {chatErr && <p style={{ color: '#ef4444', fontSize: 12.5 }}>{chatErr}</p>}
              {chatMsg && <p style={{ color: '#16a34a', fontSize: 12.5, fontWeight: 600 }}>{chatMsg}</p>}
              <button
                onClick={openChat}
                disabled={chatBusy}
                style={{ ...buttonStyle('primary', { disabled: chatBusy }), alignSelf: 'flex-start' }}
              >
                {chatBusy ? '개설 중…' : '채팅방 개설'}
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>채팅방 열기</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, lineHeight: 1.5 }}>
                    {chatOpen ? '방문자가 메시지를 남길 수 있어요.' : '닫으면 방문자에게 채팅방이 보이지 않아요.'}
                    {chatMsgCount > 0 && ` · 메시지 ${chatMsgCount}개`}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChatOpen((v) => !v)}
                  aria-pressed={chatOpen}
                  aria-label="채팅방 열기"
                  style={{ flexShrink: 0, width: 46, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', position: 'relative', background: chatOpen ? '#111827' : '#d1d5db', transition: 'background .15s' }}
                >
                  <span style={{ position: 'absolute', top: 3, left: chatOpen ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
                </button>
              </div>
              <div>
                <label style={labelStyle}>공지 (선택)</label>
                <input
                  value={chatNotice}
                  onChange={(e) => setChatNotice(e.target.value)}
                  maxLength={200}
                  placeholder="예) 예약·문의는 채팅으로 남겨주세요"
                  style={inputStyle}
                />
              </div>
              {chatErr && <p style={{ color: '#ef4444', fontSize: 12.5 }}>{chatErr}</p>}
              {chatMsg && <p style={{ color: '#16a34a', fontSize: 12.5, fontWeight: 600 }}>{chatMsg}</p>}
              <button
                onClick={saveChat}
                disabled={chatBusy}
                style={{ ...buttonStyle('primary', { disabled: chatBusy }), alignSelf: 'flex-start' }}
              >
                {chatBusy ? '저장 중…' : '저장하기'}
              </button>
            </>
          )}
        </Card>

        {chatRoom && chatOpen && (
          <Card style={{ padding: 0, marginTop: 10, overflow: 'hidden' }}>
            <div style={{ height: 460 }}>
              <ChatRoom
                key={chatVersion}
                spotId={id}
                spotName={spot.name}
                notice={chatNotice || null}
                onClose={() => {}}
                embedded
                canModerate
              />
            </div>
          </Card>
        )}

        {chatReports.length > 0 && (
          <Card style={{ marginTop: 10, padding: 16 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827', marginBottom: 10 }}>
              신고된 메시지 {chatReports.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chatReports.map((r) => (
                <div key={r.id} style={{ border: '1px solid #fee2e2', background: '#fff7f7', borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#991b1b', background: '#fee2e2', borderRadius: 5, padding: '1px 6px' }}>
                      {REPORT_REASON[r.reason] ?? r.reason}
                    </span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{r.nickname}</span>
                    <span style={{ fontSize: 11, color: '#d1d5db' }}>
                      {new Date(r.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {r.deleted ? <span style={{ color: '#9ca3af' }}>(삭제된 메시지)</span> : r.body}
                  </div>
                  {r.detail && (
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>신고 상세: {r.detail}</div>
                  )}
                  {!r.deleted && (
                    <button
                      type="button"
                      onClick={() => deleteReported(r.message_id)}
                      style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: '#dc2626', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    >
                      메시지 삭제
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>

      {/* Edit */}
      <section>
        <h2 style={sectionLabel}>가게 정보</h2>
        <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>소개</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="가게 소개를 적어주세요 (최대 500자)"
              style={{ ...inputStyle, height: 'auto', padding: 12, resize: 'none', lineHeight: 1.5 }}
            />
          </div>
          <div>
            <label style={labelStyle}>영업시간</label>
            <input
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              maxLength={100}
              placeholder="예) 매일 18:00 - 02:00"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>전화번호</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
              placeholder="예) 0507-1234-5678"
              style={inputStyle}
            />
          </div>
          <p style={{ fontSize: 11.5, color: '#9ca3af', lineHeight: 1.55 }}>
            가게명 · 위치 · 인스타 계정은 운영자가 관리해요. 변경이 필요하면 contact@higgsi.com 으로 알려주세요.
          </p>
          {error && <p style={{ color: '#ef4444', fontSize: 12.5 }}>{error}</p>}
          {savedMsg && <p style={{ color: '#16a34a', fontSize: 12.5, fontWeight: 600 }}>{savedMsg}</p>}
          <button
            onClick={save}
            disabled={saving}
            style={{ ...buttonStyle('primary', { disabled: saving }), alignSelf: 'flex-start' }}
          >
            {saving ? '저장 중…' : '저장하기'}
          </button>
        </Card>
      </section>
    </div>
  );
}

export default function SpotManagePage() {
  return (
    <AuthGate>
      <SpotManageContent />
    </AuthGate>
  );
}

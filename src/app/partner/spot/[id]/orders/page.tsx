'use client';

// 주문 보드 — 영업 중 태블릿/폰에 켜두는 화면. 5초 폴링 + 새 주문 비프음.
// 상태 흐름: 접수 대기(new) → 준비 중(accepted) → 완료(done) / 취소.
// 하단에 좌석별 누적 합계(카운터 계산 대조용)와 영업 마감 버튼.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AuthGate from '../../../AuthGate';
import { Card, PageHeader, Spinner, buttonStyle } from '../../../ui';

interface OrderItem {
  item_name: string;
  price: number;
  qty: number;
  request: string | null;
  gift_target_seat: string | null;
}
interface Order {
  id: string;
  seat_label: string;
  status: 'new' | 'accepted' | 'done' | 'canceled';
  total: number;
  created_at: string;
  items: OrderItem[];
}
interface QuestClaim {
  id: string;
  status: 'claimed' | 'rewarded';
  claimed_at: string;
  title: string;
  reward: string;
  seat_label: string;
}

const LIVE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ready', label: '☕ 준비 중' },
  { value: 'open', label: '🟢 자리 여유' },
  { value: 'busy', label: '⚡ 빠르게 참' },
  { value: 'full', label: '🔴 만석' },
  { value: 'closed', label: '휴무' },
];

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => ctx.close();
  } catch {
    /* 오디오 권한 없으면 무음 */
  }
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  return `${Math.floor(m / 60)}시간 ${m % 60}분 전`;
}

function OrdersBoard() {
  const { id } = useParams<{ id: string }>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [seatTotals, setSeatTotals] = useState<Record<string, number>>({});
  const [claims, setClaims] = useState<QuestClaim[]>([]);
  const [liveStatus, setLiveStatus] = useState<string>('open');
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const knownIds = useRef<Set<string> | null>(null);

  const reload = useCallback(async () => {
    const [res, qRes] = await Promise.all([
      fetch(`/api/partner/spots/${id}/orders`),
      fetch(`/api/partner/spots/${id}/quests`),
    ]);
    if (!res.ok) return;
    const d = await res.json();
    const q = qRes.ok ? await qRes.json() : { claims: [] };
    const list: Order[] = d.orders ?? [];
    const claimList: QuestClaim[] = q.claims ?? [];
    // 첫 로드는 소리 없이, 이후 새 주문/새 달성 등장 시 비프
    if (knownIds.current) {
      const fresh =
        list.some((o) => !knownIds.current!.has(o.id)) ||
        claimList.some((c) => !knownIds.current!.has(c.id));
      if (fresh) beep();
    }
    knownIds.current = new Set([...list.map((o) => o.id), ...claimList.map((c) => c.id)]);
    setOrders(list);
    setSeatTotals(d.seat_totals ?? {});
    setClaims(claimList);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetch(`/api/partner/spots/${id}/tables`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.config?.live_status && setLiveStatus(d.config.live_status))
      .catch(() => {});
  }, [id]);

  const setLive = async (v: string) => {
    setLiveStatus(v);
    await fetch(`/api/partner/spots/${id}/tables`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ live_status: v }),
    });
  };

  const rewardClaim = async (claimId: string) => {
    setClaims((prev) => prev.map((c) => (c.id === claimId ? { ...c, status: 'rewarded' } : c)));
    await fetch(`/api/partner/spots/${id}/quests`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim_id: claimId }),
    });
    reload();
  };

  useEffect(() => {
    reload();
    const iv = setInterval(reload, 5000);
    return () => clearInterval(iv);
  }, [reload]);

  const setStatus = async (orderId: string, status: Order['status']) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    await fetch(`/api/partner/spots/${id}/orders`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, status }),
    });
    reload();
  };

  const closeDay = async () => {
    if (!confirm('영업을 마감할까요?\n모든 체크인 세션이 종료되고 손님 프로필이 삭제됩니다.')) return;
    setClosing(true);
    const res = await fetch(`/api/partner/spots/${id}/close`, { method: 'POST' });
    setClosing(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alert(d.error || '마감에 실패했어요.');
    alert(`영업 마감 완료 🍶\n체크인 ${d.sessions_closed}건 종료\n오늘 주문 ${d.orders_count}건 · ₩${(d.orders_total ?? 0).toLocaleString()}`);
    reload();
  };

  if (loading) return <Spinner />;

  const waiting = orders.filter((o) => o.status === 'new');
  const working = orders.filter((o) => o.status === 'accepted');
  const finished = orders.filter((o) => o.status === 'done' || o.status === 'canceled');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <PageHeader
        title="주문 보드"
        subtitle="영업 중엔 이 화면을 켜두세요. 새 주문이 오면 소리로 알려드려요."
        action={
          <button onClick={closeDay} disabled={closing} style={buttonStyle('outline', { disabled: closing })}>
            {closing ? '마감 중…' : '영업 마감'}
          </button>
        }
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href={`/partner/spot/${id}/tables`} style={{ ...buttonStyle('outline'), height: 38, padding: '0 14px', fontSize: 12.5 }}>
          ← 배치도
        </Link>
        <Link href={`/partner/spot/${id}/menu`} style={{ ...buttonStyle('outline'), height: 38, padding: '0 14px', fontSize: 12.5 }}>
          ← 메뉴
        </Link>
        <Link href={`/partner/spot/${id}/quests`} style={{ ...buttonStyle('outline'), height: 38, padding: '0 14px', fontSize: 12.5 }}>
          ← 퀘스트
        </Link>
      </div>

      {/* 라이브 상태 원터치 — 손님 페이지 배지에 즉시 반영 */}
      <Card style={{ padding: '13px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#6b7280', marginBottom: 9 }}>지금 가게 상태</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {LIVE_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setLive(o.value)}
              style={{ padding: '8px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 800, border: '1px solid', borderColor: liveStatus === o.value ? '#111827' : '#e5e7eb', background: liveStatus === o.value ? '#111827' : '#fff', color: liveStatus === o.value ? '#fff' : '#374151', cursor: 'pointer' }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Card>

      {/* 퀘스트 달성 알림 */}
      {claims.filter((c) => c.status === 'claimed').length > 0 && (
        <Section label={`퀘스트 달성 ${claims.filter((c) => c.status === 'claimed').length}`}>
          {claims
            .filter((c) => c.status === 'claimed')
            .map((c) => (
              <Card key={c.id} style={{ padding: '14px 16px', borderLeft: '4px solid #f59e0b' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 17, fontWeight: 800, color: '#111827' }}>Seat {c.seat_label}</span>
                  <span style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 600 }}>{timeAgo(c.claimed_at)}</span>
                </div>
                <div style={{ fontSize: 13.5, color: '#111827', fontWeight: 700, marginTop: 6 }}>🎯 {c.title}</div>
                <div style={{ fontSize: 12.5, color: '#7c3aed', fontWeight: 700, marginTop: 2 }}>보상: {c.reward}</div>
                <button
                  onClick={() => rewardClaim(c.id)}
                  style={{ width: '100%', height: 42, marginTop: 10, borderRadius: 10, background: '#111827', color: '#fff', fontSize: 13.5, fontWeight: 800, border: 'none', cursor: 'pointer' }}
                >
                  보상 지급 완료
                </button>
              </Card>
            ))}
        </Section>
      )}

      {waiting.length === 0 && working.length === 0 && (
        <Card dashed style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13.5 }}>
          대기 중인 주문이 없어요. 새 주문이 오면 여기에 소리와 함께 떠요.
        </Card>
      )}

      {waiting.length > 0 && <Section label={`접수 대기 ${waiting.length}`}>{waiting.map((o) => <OrderCard key={o.id} o={o} onStatus={setStatus} />)}</Section>}
      {working.length > 0 && <Section label={`준비 중 ${working.length}`}>{working.map((o) => <OrderCard key={o.id} o={o} onStatus={setStatus} />)}</Section>}

      {/* 좌석별 누적 — 카운터 계산 대조용 */}
      {Object.keys(seatTotals).length > 0 && (
        <Card style={{ padding: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 800, color: '#6b7280', marginBottom: 10 }}>좌석별 누적 (오늘)</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
            {Object.entries(seatTotals)
              .sort(([a], [b]) => a.localeCompare(b, 'ko', { numeric: true }))
              .map(([seat, total]) => (
                <div key={seat} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: '9px 12px' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#7c3aed' }}>Seat {seat}</div>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: '#111827', marginTop: 2 }}>₩{total.toLocaleString()}</div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {finished.length > 0 && (
        <Section label={`처리 완료 ${finished.length}`}>
          {finished.slice(0, 20).map((o) => (
            <OrderCard key={o.id} o={o} onStatus={setStatus} muted />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <h2 style={{ fontSize: 13, fontWeight: 800, color: '#6b7280', margin: '0 2px' }}>{label}</h2>
      {children}
    </section>
  );
}

function OrderCard({ o, onStatus, muted = false }: { o: Order; onStatus: (id: string, s: Order['status']) => void; muted?: boolean }) {
  const isService = o.total === 0;
  return (
    <Card style={{ padding: '14px 16px', opacity: muted ? 0.65 : 1, borderLeft: isService && !muted ? '4px solid #7c3aed' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontSize: 17, fontWeight: 800, color: '#111827' }}>Seat {o.seat_label}</span>
        <span style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 600 }}>{timeAgo(o.created_at)}</span>
        <span style={{ marginLeft: 'auto', fontSize: 14, fontWeight: 800, color: '#111827' }}>
          {isService ? '요청' : `₩${o.total.toLocaleString()}`}
        </span>
      </div>
      {o.items.map((it, i) => (
        <div key={i} style={{ fontSize: 13.5, color: '#111827', padding: '3px 0', fontWeight: 600 }}>
          · {it.item_name} × {it.qty}
          {it.gift_target_seat && <span style={{ color: '#7c3aed', fontWeight: 800 }}> → Seat {it.gift_target_seat}</span>}
          {it.request && <span style={{ color: '#dc2626', fontWeight: 700 }}> ({it.request})</span>}
        </div>
      ))}
      {(o.status === 'new' || o.status === 'accepted') && (
        <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
          {o.status === 'new' && (
            <button onClick={() => onStatus(o.id, 'accepted')} style={{ flex: 1, height: 42, borderRadius: 10, background: '#111827', color: '#fff', fontSize: 13.5, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
              접수
            </button>
          )}
          <button onClick={() => onStatus(o.id, 'done')} style={{ flex: 1, height: 42, borderRadius: 10, background: o.status === 'accepted' ? '#111827' : '#fff', color: o.status === 'accepted' ? '#fff' : '#374151', fontSize: 13.5, fontWeight: 800, border: '1px solid #e5e7eb', cursor: 'pointer' }}>
            완료
          </button>
          <button onClick={() => confirm('이 주문을 취소할까요?') && onStatus(o.id, 'canceled')} style={{ width: 70, height: 42, borderRadius: 10, background: '#fff', color: '#dc2626', fontSize: 12.5, fontWeight: 700, border: '1px solid #fecaca', cursor: 'pointer' }}>
            취소
          </button>
        </div>
      )}
    </Card>
  );
}

export default function OrdersPage() {
  return (
    <AuthGate>
      <OrdersBoard />
    </AuthGate>
  );
}

'use client';

// 주문 보드 — 영업 중 태블릿/폰에 켜두는 화면. 5초 폴링 + 새 주문 비프음.
// 상태 흐름: 접수 대기(new) → 준비 중(accepted) → 완료(done) / 취소.
// 하단에 좌석별 누적 합계(카운터 계산 대조용)와 영업 마감 버튼.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AuthGate from '../../../AuthGate';
import TesterGate from '../../../TesterGate';
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
interface Song {
  id: string;
  seat_label: string;
  title: string;
  artist: string | null;
  status: 'queued' | 'played' | 'skipped';
  created_at: string;
}
interface PosOrder {
  id: string;
  order_number: string;
  state: string;
  created_at: string;
  total: number;
  items: { name: string; qty: number; price: number }[];
}
interface BoardSeat {
  id: string;
  label: string;
  row: number;
  col: number;
  seat_type: 'seat' | 'buffer' | 'block';
}
interface BoardZone {
  id: string;
  name: string;
  grid_rows: number;
  grid_cols: number;
  seats: BoardSeat[];
}

const LIVE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ready', label: '☕ 준비 중' },
  { value: 'open', label: '🟢 자리 여유' },
  { value: 'busy', label: '⚡ 빠르게 참' },
  { value: 'full', label: '🔴 만석' },
  { value: 'closed', label: '휴무' },
];

// 도어차임 스타일 딩-동 (B5→E6) — 순수 WebAudio 합성이라 소리 파일 불필요.
// soft=true는 미접수 리마인더용 (한 음, 더 작게).
function beep(soft = false) {
  try {
    const ctx = new AudioContext();
    const note = (freq: number, t0: number, dur: number, peak: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(g);
      g.connect(ctx.destination);
      const t = ctx.currentTime + t0;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t);
      osc.stop(t + dur);
    };
    if (soft) {
      note(987.77, 0, 0.7, 0.09); // B5 한 음, 낮은 볼륨
    } else {
      note(987.77, 0, 0.9, 0.16); // B5 "딩"
      note(1318.51, 0.13, 1.1, 0.15); // E6 "동"
    }
    setTimeout(() => ctx.close(), 1600);
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
  const [songs, setSongs] = useState<Song[]>([]);
  const [liveStatus, setLiveStatus] = useState<string>('open');
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const knownIds = useRef<Set<string> | null>(null);
  // 미니 좌석맵 + 채팅 배지 + 미접수 리마인더용
  const [zones, setZones] = useState<BoardZone[]>([]);
  const [spotSlug, setSpotSlug] = useState('');
  const [occupied, setOccupied] = useState<Set<string>>(new Set());
  const [posOrders, setPosOrders] = useState<PosOrder[]>([]);
  const [chatNew, setChatNew] = useState(0); // 보드 켠 이후 새 채팅 수
  const chatBase = useRef<number | null>(null);
  const waitingRef = useRef(0);
  const tickRef = useRef(0); // 포스 주문은 3틱(15초)마다 — 토스 호출 절약

  const reload = useCallback(async () => {
    const withPos = tickRef.current % 3 === 0;
    tickRef.current++;
    const [res, qRes, sRes, cRes] = await Promise.all([
      fetch(`/api/partner/spots/${id}/orders${withPos ? '?pos=1' : ''}`),
      fetch(`/api/partner/spots/${id}/quests`),
      fetch(`/api/partner/spots/${id}/songs`),
      fetch(`/api/chat/${id}`), // 공개 GET — message_count로 새 채팅 배지
    ]);
    if (!res.ok) return;
    const d = await res.json();
    const q = qRes.ok ? await qRes.json() : { claims: [] };
    const s = sRes.ok ? await sRes.json() : { songs: [] };
    if (cRes.ok) {
      const c = await cRes.json();
      const count: number = c.message_count ?? 0;
      if (chatBase.current === null) chatBase.current = count; // 첫 로드 기준점
      setChatNew(Math.max(0, count - chatBase.current));
    }
    const list: Order[] = d.orders ?? [];
    const claimList: QuestClaim[] = q.claims ?? [];
    const songList: Song[] = s.songs ?? [];
    // 첫 로드는 소리 없이, 이후 새 주문/새 달성/새 신청곡 등장 시 비프
    if (knownIds.current) {
      const fresh =
        list.some((o) => !knownIds.current!.has(o.id)) ||
        claimList.some((c) => !knownIds.current!.has(c.id)) ||
        songList.some((sg) => !knownIds.current!.has(sg.id));
      if (fresh) beep();
    }
    knownIds.current = new Set([
      ...list.map((o) => o.id),
      ...claimList.map((c) => c.id),
      ...songList.map((sg) => sg.id),
    ]);
    setOrders(list);
    setSeatTotals(d.seat_totals ?? {});
    setClaims(claimList);
    setSongs(songList);
    setOccupied(new Set<string>(d.occupied_seat_ids ?? []));
    if (Array.isArray(d.pos_orders)) setPosOrders(d.pos_orders); // null = 이번 틱 미조회, 기존 유지
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetch(`/api/partner/spots/${id}/tables`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.config?.live_status) setLiveStatus(d.config.live_status);
        if (d?.zones) setZones(d.zones); // 미니 좌석맵 배치도
        if (d?.spot?.slug) setSpotSlug(d.spot.slug);
      })
      .catch(() => {});
  }, [id]);

  // 미접수 리마인더 — "접수 대기"가 남아 있으면 30초마다 부드러운 한 음.
  useEffect(() => {
    const iv = setInterval(() => {
      if (waitingRef.current > 0) beep(true);
    }, 30000);
    return () => clearInterval(iv);
  }, []);

  // 화면 꺼짐 방지 — 영업 중 보드를 켜두는 화면이라 Wake Lock 유지.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const acquire = async () => {
      try {
        type WakeLockNav = Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
        lock = (await (navigator as WakeLockNav).wakeLock?.request('screen')) ?? null;
      } catch {
        /* 미지원/저전력 모드면 무시 */
      }
    };
    acquire();
    const onVisible = () => document.visibilityState === 'visible' && acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, []);

  const setLive = async (v: string) => {
    setLiveStatus(v);
    await fetch(`/api/partner/spots/${id}/tables`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ live_status: v }),
    });
  };

  // 탭 배지 — 브라우저 탭 제목에 처리 대기 건수. 리마인더 카운터도 여기서 동기화.
  useEffect(() => {
    const newOrders = orders.filter((o) => o.status === 'new').length;
    waitingRef.current = newOrders;
    const n =
      newOrders +
      songs.filter((s) => s.status === 'queued').length +
      claims.filter((c) => c.status === 'claimed').length;
    document.title = n > 0 ? `(${n}) 주문 보드 | 혼술맵` : '주문 보드 | 혼술맵';
  }, [orders, songs, claims]);

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

  const kickSeat = async (seat: BoardSeat) => {
    const total = seatTotals[seat.label] ?? 0;
    if (
      !confirm(
        `Seat ${seat.label} 체크아웃할까요?\n오늘 누적 ₩${total.toLocaleString()} — 카운터 결제 확인 후 진행하세요.\n(좌석이 비워지고, 같은 손님이 다시 오면 새로 체크인합니다)`,
      )
    )
      return;
    setOccupied((prev) => {
      const next = new Set(prev);
      next.delete(seat.id);
      return next;
    });
    await fetch(`/api/partner/spots/${id}/orders`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ end_seat_session: seat.id }),
    });
    reload();
  };

  const setSongStatus = async (songId: string, status: Song['status']) => {
    setSongs((prev) => prev.map((s) => (s.id === songId ? { ...s, status } : s)));
    await fetch(`/api/partner/spots/${id}/songs`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: songId, status }),
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

  // 간편 흐름 — 접수 단계 없이 [확인]/[취소] 원탭. 주방에 갈 주문과 ₩0 서비스
  // 요청(호출·자리변경·신고 등)은 성격이 달라 섹션을 분리한다.
  const activeAll = orders.filter((o) => o.status === 'new' || o.status === 'accepted');
  const serviceReqs = activeAll.filter((o) => o.total === 0);
  const active = activeAll.filter((o) => o.total > 0);
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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Link href={`/partner/spot/${id}/tables`} style={{ ...buttonStyle('outline'), height: 38, padding: '0 14px', fontSize: 12.5 }}>
          ← 테이블 설정 (배치도·메뉴·퀘스트)
        </Link>
        {chatNew > 0 && spotSlug && (
          <Link
            href={`/spot/${spotSlug}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px', borderRadius: 10, background: '#f5f3ff', border: '1px solid #ddd6fe', fontSize: 12.5, fontWeight: 800, color: '#7c3aed', textDecoration: 'none' }}
          >
            💬 새 채팅 {chatNew}개 →
          </Link>
        )}
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

      {/* 신청곡 — 대기는 액션 카드, 처리된 곡(재생/패스)도 오늘 이력으로 남긴다
          (전부 처리하면 섹션째 사라져 "신청곡이 안 뜬다"로 보이던 문제 방지) */}
      {songs.length > 0 && (
        <Section label={`신청곡 대기 ${songs.filter((s) => s.status === 'queued').length} · 오늘 ${songs.length}곡`}>
          {songs
            .filter((s) => s.status === 'queued')
            .map((s) => (
              <Card key={s.id} style={{ padding: '13px 16px', borderLeft: '4px solid #7c3aed' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>
                    🎵 {s.title}
                    {s.artist && <span style={{ fontWeight: 600, color: '#6b7280' }}> — {s.artist}</span>}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#7c3aed' }}>Seat {s.seat_label}</span>
                  <span style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 600 }}>{timeAgo(s.created_at)}</span>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setSongStatus(s.id, 'played')}
                      style={{ height: 34, padding: '0 13px', borderRadius: 9, background: '#111827', color: '#fff', fontSize: 12, fontWeight: 800, border: 'none', cursor: 'pointer' }}
                    >
                      재생됨
                    </button>
                    <button
                      onClick={() => setSongStatus(s.id, 'skipped')}
                      style={{ height: 34, padding: '0 13px', borderRadius: 9, background: '#fff', color: '#6b7280', fontSize: 12, fontWeight: 700, border: '1px solid #e5e7eb', cursor: 'pointer' }}
                    >
                      패스
                    </button>
                  </span>
                </div>
              </Card>
            ))}
          {songs.filter((s) => s.status !== 'queued').length > 0 && (
            <Card style={{ padding: '10px 16px' }}>
              {songs
                .filter((s) => s.status !== 'queued')
                .slice(0, 8)
                .map((s) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 12.5, color: '#9ca3af' }}>
                    <span style={{ fontWeight: 700 }}>
                      🎵 {s.title}
                      {s.artist && ` — ${s.artist}`}
                    </span>
                    <span style={{ fontSize: 11 }}>Seat {s.seat_label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: s.status === 'played' ? '#16a34a' : '#c4c9d0' }}>
                      {s.status === 'played' ? '재생됨' : '패스'}
                    </span>
                  </div>
                ))}
            </Card>
          )}
        </Section>
      )}

      {activeAll.length === 0 && (
        <Card dashed style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13.5 }}>
          대기 중인 주문이 없어요. 새 주문이 오면 여기에 소리와 함께 떠요.
        </Card>
      )}

      {serviceReqs.length > 0 && (
        <Section label={`서비스 요청 ${serviceReqs.length}`}>
          {serviceReqs.map((o) => <OrderCard key={o.id} o={o} onStatus={setStatus} />)}
        </Section>
      )}
      {active.length > 0 && <Section label={`새 주문 ${active.length}`}>{active.map((o) => <OrderCard key={o.id} o={o} onStatus={setStatus} />)}</Section>}

      {/* 포스 주문 — 토스 연동 가게: 포스에서 찍힌 주문을 읽기 전용으로 (원장은 포스) */}
      {posOrders.length > 0 && (
        <Section label={`포스 주문 (오늘 ${posOrders.length})`}>
          <Card style={{ padding: '6px 16px' }}>
            {posOrders.slice(0, 20).map((o) => (
              <div key={o.id} style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '9px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                <span style={{ fontWeight: 800, color: '#111827', flexShrink: 0 }}>#{o.order_number}</span>
                <span style={{ color: '#374151', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.items.map((it) => `${it.name}×${it.qty}`).join(', ') || '—'}
                </span>
                <span style={{ marginLeft: 'auto', flexShrink: 0, fontWeight: 800, color: '#111827' }}>₩{o.total.toLocaleString()}</span>
                <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 800, color: o.state === 'COMPLETED' ? '#16a34a' : o.state === 'CANCELLED' ? '#dc2626' : '#7c3aed' }}>
                  {o.state === 'COMPLETED' ? '완료' : o.state === 'CANCELLED' ? '취소' : '진행 중'}
                </span>
                <span style={{ flexShrink: 0, fontSize: 11, color: '#9ca3af' }}>{timeAgo(o.created_at)}</span>
              </div>
            ))}
          </Card>
        </Section>
      )}

      {/* 미니 좌석맵 — 지금 홀 상황 (읽기 전용, 5초 폴링 반영) */}
      {zones.length > 0 && (
        <Card style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
            <h2 style={{ fontSize: 13, fontWeight: 800, color: '#6b7280' }}>지금 홀 상황</h2>
            <span style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 600 }}>
              {zones.reduce((acc, z) => acc + z.seats.filter((s) => s.seat_type === 'seat' && occupied.has(s.id)).length, 0)}/
              {zones.reduce((acc, z) => acc + z.seats.filter((s) => s.seat_type === 'seat').length, 0)} 사용 중
            </span>
            <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>사용 중 좌석 탭 = 체크아웃 (누적 확인 후 좌석 비우기)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {zones.map((z) => (
              <div key={z.id}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: '#374151', marginBottom: 6 }}>{z.name}</div>
                <div style={{ overflowX: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${z.grid_cols}, minmax(24px, 30px))`, gap: 4 }}>
                    {Array.from({ length: z.grid_rows * z.grid_cols }, (_, i) => {
                      const row = Math.floor(i / z.grid_cols);
                      const col = i % z.grid_cols;
                      const seat = z.seats.find((s) => s.row === row && s.col === col);
                      if (!seat) return <div key={i} style={{ aspectRatio: '1' }} />;
                      if (seat.seat_type === 'block')
                        return <div key={i} style={{ aspectRatio: '1', borderRadius: 6, background: '#f3f4f6' }} />;
                      const on = occupied.has(seat.id);
                      return (
                        <button
                          key={i}
                          onClick={() => on && kickSeat(seat)}
                          title={on ? `Seat ${seat.label} 세션 종료` : undefined}
                          style={{
                            aspectRatio: '1',
                            borderRadius: 6,
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 9.5,
                            fontWeight: 800,
                            padding: 0,
                            background: on ? '#111827' : '#fff',
                            color: on ? '#fff' : '#9ca3af',
                            border: on ? '1.4px solid #111827' : seat.seat_type === 'buffer' ? '1.4px dashed #d1d5db' : '1.4px solid #d1d5db',
                            cursor: on ? 'pointer' : 'default',
                          }}
                        >
                          {seat.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

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
      {/* 완료된 주문도 취소 가능 — 오주문·테스트 주문을 좌석 누적에서 제외 (기록은 취소로 남음) */}
      {o.status === 'done' && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 9 }}>
          <button
            onClick={() => confirm('이 주문을 취소 처리할까요?\n좌석 누적과 오늘 매출 대조에서 빠져요.') && onStatus(o.id, 'canceled')}
            style={{ height: 32, padding: '0 12px', borderRadius: 9, background: '#fff', color: '#dc2626', fontSize: 11.5, fontWeight: 700, border: '1px solid #fecaca', cursor: 'pointer' }}
          >
            주문 취소
          </button>
        </div>
      )}
      {(o.status === 'new' || o.status === 'accepted') && (
        <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
          <button onClick={() => onStatus(o.id, 'done')} style={{ flex: 1, height: 42, borderRadius: 10, background: '#111827', color: '#fff', fontSize: 13.5, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
            확인 완료
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
      <TesterGate>
        <OrdersBoard />
      </TesterGate>
    </AuthGate>
  );
}

'use client';

// 테이블 모드 손님 화면 — 체크인 → 좌석맵/메뉴/내주문 탭.
// 세션은 localStorage(sid)로 복구, 좌석 점유는 /state 20초 폴링.
// ₩0 아이템(호출·추천·신고·선물)은 장바구니 없이 원탭 전송.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GamesTab from './GamesTab';

type SeatType = 'seat' | 'buffer' | 'block';
export interface Zone {
  id: string;
  name: string;
  grid_rows: number;
  grid_cols: number;
}
export interface Seat {
  id: string;
  zone_id: string;
  label: string;
  row: number;
  col: number;
  seat_type: SeatType;
}
export interface MenuItem {
  id: string;
  name: string;
  price: number;
  description: string | null;
  sold_out: boolean;
  zero_action: 'call' | 'recommend' | 'report' | 'gift' | null;
}
export interface MenuCategory {
  id: string;
  name: string;
  items: MenuItem[];
}
export interface PublicSession {
  seat_id: string;
  gender: 'm' | 'f' | null;
  is_public: boolean;
  age_band?: string | null;
  mbti?: string | null;
  purpose?: string | null;
  vibe?: string | null;
  tmi?: string | null;
  drink_pref?: string | null;
}
interface MySession {
  id: string;
  seat_id: string;
  seat_label: string;
  gender: 'm' | 'f' | null;
}
interface OrderRow {
  id: string;
  status: string;
  total: number;
  created_at: string;
  items: { item_name: string; price: number; qty: number; request: string | null; gift_target_seat: string | null }[];
}
interface Quest {
  id: string;
  title: string;
  reward: string;
  hidden: boolean;
  my_status: 'claimed' | 'rewarded' | null;
}

const INK = '#111827';
const MUTED = '#6b7280';
const FAINT = '#9ca3af';
const LINE = '#e5e7eb';
const ACCENT = '#7c3aed';

const LIVE_LABEL: Record<string, string> = {
  ready: '☕ 오픈 준비 중',
  open: '🟢 자리 여유 있어요',
  busy: '⚡ 빠르게 자리 차는 중',
  full: '🔴 지금 만석이에요',
  closed: '오늘은 휴무예요',
};
const AGE_BANDS = ['20대 초반', '20대 중반', '20대 후반', '30대 초반', '30대 중반', '30대 후반', '40대+'];
const PURPOSES = ['편하게 대화하고 싶어요', '새로운 사람 만나고 싶어요', '말 걸어주시면 감사하겠습니다', '조용히 마시고 싶어요'];
const VIBES = ['차분함', '적당히 활발함', '텐션 높음'];
const MBTIS = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'];
const STATUS_LABEL: Record<string, string> = { new: '접수 대기', accepted: '준비 중', done: '완료', canceled: '취소됨' };

export default function TableClient({
  spot,
  modes,
  liveStatus: liveInit,
  zones,
  seats,
  categories,
  initialSessions,
  seatParam,
}: {
  spot: { id: string; name: string; slug: string };
  modes: { order?: boolean; social?: boolean };
  liveStatus: string;
  zones: Zone[];
  seats: Seat[];
  categories: MenuCategory[];
  initialSessions: PublicSession[];
  seatParam: string | null;
}) {
  const social = modes.social !== false;
  const orderOn = modes.order !== false;
  const storageKey = `hsm_t_${spot.id}`;

  const [tab, setTab] = useState<'map' | 'menu' | 'games' | 'orders'>('map');
  const [quests, setQuests] = useState<Quest[]>([]);
  const [questsOpen, setQuestsOpen] = useState(false);
  const [session, setSession] = useState<MySession | null>(null);
  const [sessions, setSessions] = useState<PublicSession[]>(initialSessions);
  const [liveStatus, setLiveStatus] = useState(liveInit);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [profileView, setProfileView] = useState<{ seat: Seat; s: PublicSession } | null>(null);
  const [cart, setCart] = useState<{ item: MenuItem; qty: number; request: string }[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [giftPick, setGiftPick] = useState<MenuItem | null>(null);
  const [myOrders, setMyOrders] = useState<OrderRow[]>([]);
  const [seatTotal, setSeatTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(''), 2600);
  }, []);

  // ── 세션 복구 ──
  useEffect(() => {
    const sid = localStorage.getItem(storageKey);
    if (!sid) return;
    fetch(`/api/t/${spot.slug}/checkin?sid=${sid}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.session) setSession(d.session);
        else localStorage.removeItem(storageKey);
      })
      .catch(() => {});
  }, [spot.slug, storageKey]);

  // ── 상태 폴링 ──
  const refreshState = useCallback(() => {
    fetch(`/api/t/${spot.slug}/state`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setSessions(d.sessions ?? []);
        setLiveStatus(d.live_status ?? 'open');
      })
      .catch(() => {});
  }, [spot.slug]);

  useEffect(() => {
    const iv = setInterval(refreshState, 20_000);
    const onVis = () => document.visibilityState === 'visible' && refreshState();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refreshState]);

  // ── 내 주문 ──
  const refreshOrders = useCallback(() => {
    if (!session) return;
    fetch(`/api/t/${spot.slug}/orders?sid=${session.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setMyOrders(d.orders ?? []);
        setSeatTotal(d.seat_total ?? 0);
      })
      .catch(() => {});
  }, [session, spot.slug]);

  useEffect(() => {
    if (tab === 'orders') refreshOrders();
  }, [tab, refreshOrders]);

  // ── 퀘스트 ──
  const refreshQuests = useCallback(() => {
    fetch(`/api/t/${spot.slug}/quests${session ? `?sid=${session.id}` : ''}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setQuests(d.quests ?? []))
      .catch(() => {});
  }, [spot.slug, session]);

  useEffect(() => {
    refreshQuests();
  }, [refreshQuests]);

  const claimQuest = async (q: Quest) => {
    if (!session) return setCheckinOpen(true);
    if (!confirm(`'${q.title}' 달성으로 신고할까요?\n직원이 확인 후 보상을 드려요.`)) return;
    const res = await fetch(`/api/t/${spot.slug}/quests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: session.id, quest_id: q.id }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 409) return showToast(d.error || '전송에 실패했어요.');
    showToast('달성 알림을 보냈어요! 직원이 곧 확인해요 🎉');
    refreshQuests();
  };

  const sessionBySeat = useMemo(() => {
    const m = new Map<string, PublicSession>();
    for (const s of sessions) m.set(s.seat_id, s);
    return m;
  }, [sessions]);

  const occupiedPublicSeats = useMemo(
    () =>
      seats.filter(
        (st) =>
          st.seat_type === 'seat' &&
          sessionBySeat.get(st.id)?.is_public &&
          st.id !== session?.seat_id,
      ),
    [seats, sessionBySeat, session],
  );

  // ── 주문 전송 ──
  const submitOrder = useCallback(
    async (items: { id: string; qty: number; request?: string; gift_target_seat?: string }[], successMsg: string) => {
      if (!session) {
        setCheckinOpen(true);
        return false;
      }
      setBusy(true);
      const res = await fetch(`/api/t/${spot.slug}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id, items }),
      });
      setBusy(false);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 410) {
          localStorage.removeItem(storageKey);
          setSession(null);
          setCheckinOpen(true);
        }
        showToast(d.error || '전송에 실패했어요.');
        return false;
      }
      showToast(successMsg);
      refreshOrders();
      return true;
    },
    [session, spot.slug, storageKey, showToast, refreshOrders],
  );

  const tapMenuItem = (item: MenuItem) => {
    if (item.sold_out) return;
    if (!orderOn) return;
    if (item.zero_action === 'gift') {
      if (!session) return setCheckinOpen(true);
      if (!occupiedPublicSeats.length) return showToast('지금 선물할 수 있는 좌석이 없어요.');
      setGiftPick(item);
      return;
    }
    if (item.zero_action) {
      if (!session) return setCheckinOpen(true);
      const label =
        item.zero_action === 'call' ? '직원을 호출할까요?' :
        item.zero_action === 'recommend' ? '직원에게 추천을 요청할까요?' :
        '내용은 직원만 볼 수 있어요. 보낼까요?';
      if (confirm(label)) submitOrder([{ id: item.id, qty: 1 }], '전송했어요!');
      return;
    }
    setCart((prev) => {
      const i = prev.findIndex((c) => c.item.id === item.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: Math.min(20, next[i].qty + 1) };
        return next;
      }
      return [...prev, { item, qty: 1, request: '' }];
    });
  };

  const cartTotal = cart.reduce((a, c) => a + c.item.price * c.qty, 0);
  const cartCount = cart.reduce((a, c) => a + c.qty, 0);

  const placeCart = async () => {
    const ok = await submitOrder(
      cart.map((c) => ({ id: c.item.id, qty: c.qty, request: c.request || undefined })),
      '주문이 들어갔어요! 조금만 기다려주세요 🍶',
    );
    if (ok) {
      setCart([]);
      setCartOpen(false);
    }
  };

  return (
    <div style={{ minHeight: '100dvh', background: '#f8f9fa', paddingBottom: 120 }}>
      {/* ── 헤더 ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${LINE}`, padding: '13px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: FAINT, letterSpacing: '0.3px' }}>혼술맵 테이블</div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: INK, letterSpacing: '-0.4px', marginTop: 1 }}>{spot.name}</h1>
          </div>
          {session ? (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT }}>Seat {session.seat_label}</div>
              <div style={{ fontSize: 10.5, color: FAINT }}>계산은 좌석번호로</div>
            </div>
          ) : (
            <button onClick={() => setCheckinOpen(true)} style={{ height: 38, padding: '0 16px', borderRadius: 10, background: INK, color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              좌석 체크인
            </button>
          )}
        </div>
        <div style={{ marginTop: 8, display: 'inline-flex', padding: '5px 11px', borderRadius: 999, background: '#f3f4f6', fontSize: 12, fontWeight: 700, color: '#374151' }}>
          {LIVE_LABEL[liveStatus] ?? liveStatus}
        </div>
      </div>

      {/* ── 오늘의 퀘스트 배너 ── */}
      {quests.length > 0 && tab !== 'games' && (
        <div style={{ padding: '14px 16px 0' }}>
          <button
            onClick={() => setQuestsOpen(!questsOpen)}
            style={{ width: '100%', textAlign: 'left', background: '#fff', border: `1.5px solid ${questsOpen ? INK : LINE}`, borderRadius: 14, padding: '13px 16px', cursor: 'pointer', fontSize: 13.5, fontWeight: 800, color: INK }}
          >
            🎯 오늘의 퀘스트 · {quests.length}개 {questsOpen ? '▲' : '▼'}
          </button>
          {questsOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {quests.map((q) => (
                <div key={q.id} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 13, padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: INK }}>{q.title}</span>
                    {q.hidden && (
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#92400e', background: '#fef3c7', borderRadius: 5, padding: '2px 6px' }}>🌙 HIDDEN</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: ACCENT }}>→ {q.reward}</span>
                    <span style={{ marginLeft: 'auto' }}>
                      {q.my_status === 'rewarded' ? (
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: '#16a34a' }}>보상 완료 ✓</span>
                      ) : q.my_status === 'claimed' ? (
                        <span style={{ fontSize: 11.5, fontWeight: 800, color: FAINT }}>확인 대기 중…</span>
                      ) : (
                        <button onClick={() => claimQuest(q)} style={{ height: 32, padding: '0 13px', borderRadius: 9, background: INK, color: '#fff', fontSize: 11.5, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
                          달성했어요!
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 탭 콘텐츠 ── */}
      <div style={{ padding: '16px 16px 0' }}>
        {tab === 'map' && (
          <SeatMap
            zones={zones}
            seats={seats}
            sessionBySeat={sessionBySeat}
            mySeatId={session?.seat_id ?? null}
            onTapOccupied={(seat, s) => social && s.is_public && setProfileView({ seat, s })}
          />
        )}
        {tab === 'menu' && (
          <MenuList categories={categories} orderOn={orderOn} cart={cart} onTap={tapMenuItem} />
        )}
        {tab === 'games' && <GamesTab onGoMenu={() => setTab('menu')} spotSlug={spot.slug} />}
        {tab === 'orders' && (
          <OrdersView orders={myOrders} seatTotal={seatTotal} hasSession={!!session} onCheckin={() => setCheckinOpen(true)} />
        )}
      </div>

      {/* ── 장바구니 바 ── */}
      {tab === 'menu' && cartCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          style={{ position: 'fixed', left: 16, right: 16, bottom: 76, zIndex: 30, height: 52, borderRadius: 14, background: INK, color: '#fff', fontSize: 14.5, fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: '0 8px 24px rgba(17,24,39,0.25)' }}
        >
          {cartCount}개 · ₩{cartTotal.toLocaleString()} 주문하기
        </button>
      )}

      {/* ── 하단 탭 ── */}
      <nav style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(8px)', borderTop: `1px solid ${LINE}`, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {([['map', '좌석'], ['menu', '메뉴'], ['games', '술게임'], ['orders', '내 주문']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ height: 58, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 800, color: tab === key ? INK : FAINT }}>
            {label}
          </button>
        ))}
      </nav>

      {/* ── 시트들 ── */}
      {checkinOpen && (
        <CheckinSheet
          slug={spot.slug}
          social={social}
          seatParam={seatParam}
          onClose={() => setCheckinOpen(false)}
          onDone={(s) => {
            setSession(s);
            localStorage.setItem(storageKey, s.id);
            setCheckinOpen(false);
            refreshState();
            showToast(`Seat ${s.seat_label} 체크인 완료!`);
          }}
        />
      )}
      {profileView && <ProfileSheet seat={profileView.seat} s={profileView.s} onClose={() => setProfileView(null)} />}
      {cartOpen && (
        <CartSheet
          cart={cart}
          setCart={setCart}
          total={cartTotal}
          busy={busy}
          onClose={() => setCartOpen(false)}
          onSubmit={placeCart}
        />
      )}
      {giftPick && (
        <GiftSheet
          item={giftPick}
          seats={occupiedPublicSeats}
          sessionBySeat={sessionBySeat}
          busy={busy}
          onClose={() => setGiftPick(null)}
          onSend={async (seatLabel) => {
            const ok = await submitOrder(
              [{ id: giftPick.id, qty: 1, gift_target_seat: seatLabel }],
              `Seat ${seatLabel}에게 한 잔을 보냈어요 🥂`,
            );
            if (ok) setGiftPick(null);
          }}
        />
      )}

      {toast && (
        <div style={{ position: 'fixed', left: '50%', bottom: 140, transform: 'translateX(-50%)', zIndex: 60, background: INK, color: '#fff', fontSize: 13, fontWeight: 700, padding: '11px 18px', borderRadius: 12, whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}

// ═══ 좌석맵 ═══
function SeatMap({
  zones,
  seats,
  sessionBySeat,
  mySeatId,
  onTapOccupied,
}: {
  zones: Zone[];
  seats: Seat[];
  sessionBySeat: Map<string, PublicSession>;
  mySeatId: string | null;
  onTapOccupied: (seat: Seat, s: PublicSession) => void;
}) {
  if (!zones.length)
    return <p style={{ textAlign: 'center', color: FAINT, fontSize: 13, padding: '40px 0' }}>배치도가 아직 등록되지 않았어요.</p>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {zones.map((z) => {
        const zSeats = seats.filter((s) => s.zone_id === z.id);
        return (
          <section key={z.id} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 16, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 14, fontWeight: 800, color: INK }}>{z.name}</h2>
              <span style={{ fontSize: 11, color: FAINT, fontWeight: 600 }}>
                {zSeats.filter((s) => s.seat_type === 'seat' && sessionBySeat.has(s.id)).length}/
                {zSeats.filter((s) => s.seat_type === 'seat').length} 사용 중
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${z.grid_cols}, minmax(34px, 1fr))`, gap: 5, minWidth: z.grid_cols * 39 }}>
                {Array.from({ length: z.grid_rows * z.grid_cols }, (_, i) => {
                  const row = Math.floor(i / z.grid_cols);
                  const col = i % z.grid_cols;
                  const seat = zSeats.find((s) => s.row === row && s.col === col);
                  if (!seat) return <div key={i} style={{ aspectRatio: '1' }} />;
                  if (seat.seat_type === 'block')
                    return <div key={i} style={{ aspectRatio: '1', borderRadius: 9, background: '#f3f4f6' }} />;
                  const sess = sessionBySeat.get(seat.id);
                  const mine = seat.id === mySeatId;
                  const style: React.CSSProperties = mine
                    ? { background: ACCENT, color: '#fff', border: `1.6px solid ${ACCENT}` }
                    : sess
                      ? { background: INK, color: '#fff', border: `1.6px solid ${INK}` }
                      : seat.seat_type === 'buffer'
                        ? { border: '1.6px dashed #d1d5db', color: FAINT, background: '#fff' }
                        : { background: '#fff', border: '1.6px solid #d1d5db', color: '#374151' };
                  return (
                    <button
                      key={i}
                      onClick={() => sess && !mine && onTapOccupied(seat, sess)}
                      style={{ aspectRatio: '1', borderRadius: 9, display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 800, cursor: sess && !mine ? 'pointer' : 'default', ...style }}
                    >
                      <span style={{ lineHeight: 1.15 }}>
                        {seat.label}
                        {sess?.gender && (
                          <span style={{ display: 'block', fontSize: 9, opacity: 0.85 }}>
                            {sess.gender === 'm' ? '♂' : '♀'}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', fontSize: 11, color: MUTED, fontWeight: 600, paddingBottom: 4 }}>
        <Legend swatch={{ background: '#fff', border: '1.6px solid #d1d5db' }}>빈자리</Legend>
        <Legend swatch={{ background: INK }}>사용 중</Legend>
        <Legend swatch={{ background: ACCENT }}>내 자리</Legend>
        <Legend swatch={{ border: '1.6px dashed #d1d5db' }}>대기석</Legend>
      </div>
    </div>
  );
}

function Legend({ swatch, children }: { swatch: React.CSSProperties; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 13, height: 13, borderRadius: 4, ...swatch }} />
      {children}
    </span>
  );
}

// ═══ 메뉴 ═══
function MenuList({
  categories,
  orderOn,
  cart,
  onTap,
}: {
  categories: MenuCategory[];
  orderOn: boolean;
  cart: { item: MenuItem; qty: number }[];
  onTap: (item: MenuItem) => void;
}) {
  const [catId, setCatId] = useState(categories[0]?.id ?? '');
  const current = categories.find((c) => c.id === catId) ?? categories[0];
  if (!categories.length)
    return <p style={{ textAlign: 'center', color: FAINT, fontSize: 13, padding: '40px 0' }}>메뉴가 아직 등록되지 않았어요.</p>;
  const qtyOf = (id: string) => cart.find((c) => c.item.id === id)?.qty ?? 0;
  return (
    <div>
      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 10, WebkitOverflowScrolling: 'touch' }}>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCatId(c.id)}
            style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, border: '1px solid', borderColor: current?.id === c.id ? INK : LINE, background: current?.id === c.id ? INK : '#fff', color: current?.id === c.id ? '#fff' : '#374151', cursor: 'pointer' }}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {(current?.items ?? []).map((it) => {
          const inCart = qtyOf(it.id);
          return (
            <button
              key={it.id}
              onClick={() => onTap(it)}
              disabled={it.sold_out}
              style={{ textAlign: 'left', background: '#fff', border: `1px solid ${inCart ? INK : LINE}`, borderRadius: 14, padding: '14px 16px', cursor: it.sold_out ? 'default' : 'pointer', opacity: it.sold_out ? 0.5 : 1, position: 'relative' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: INK, letterSpacing: '-0.2px' }}>
                  {it.zero_action && '💬 '}
                  {it.name}
                  {it.sold_out && <span style={{ fontSize: 11, color: '#dc2626', marginLeft: 6 }}>품절</span>}
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: INK, flexShrink: 0 }}>
                  {it.price === 0 ? '₩0' : `₩${it.price.toLocaleString()}`}
                </span>
              </div>
              {it.description && (
                <p style={{ fontSize: 12, color: MUTED, marginTop: 4, lineHeight: 1.5 }}>{it.description}</p>
              )}
              {orderOn && inCart > 0 && (
                <span style={{ position: 'absolute', top: -7, right: -5, minWidth: 22, height: 22, borderRadius: 999, background: ACCENT, color: '#fff', fontSize: 11.5, fontWeight: 800, display: 'grid', placeItems: 'center', padding: '0 6px' }}>
                  {inCart}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══ 내 주문 ═══
function OrdersView({
  orders,
  seatTotal,
  hasSession,
  onCheckin,
}: {
  orders: OrderRow[];
  seatTotal: number;
  hasSession: boolean;
  onCheckin: () => void;
}) {
  if (!hasSession)
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <p style={{ color: MUTED, fontSize: 13.5, marginBottom: 16 }}>체크인하면 주문 내역이 여기에 쌓여요.</p>
        <button onClick={onCheckin} style={{ height: 44, padding: '0 22px', borderRadius: 12, background: INK, color: '#fff', fontSize: 13.5, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          좌석 체크인
        </button>
      </div>
    );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: MUTED }}>내 좌석 누적</span>
        <span style={{ fontSize: 19, fontWeight: 800, color: INK }}>₩{seatTotal.toLocaleString()}</span>
      </div>
      {orders.length === 0 && (
        <p style={{ textAlign: 'center', color: FAINT, fontSize: 13, padding: '28px 0' }}>아직 주문이 없어요.</p>
      )}
      {orders.map((o) => (
        <div key={o.id} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '13px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontSize: 11.5, color: FAINT, fontWeight: 600 }}>
              {new Date(o.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span style={{ fontSize: 11, fontWeight: 800, color: o.status === 'canceled' ? '#dc2626' : o.status === 'done' ? '#16a34a' : ACCENT }}>
              {STATUS_LABEL[o.status] ?? o.status}
            </span>
          </div>
          {o.items.map((it, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: INK, padding: '2px 0' }}>
              <span>
                {it.item_name} × {it.qty}
                {it.gift_target_seat && <span style={{ color: ACCENT, fontWeight: 700 }}> → Seat {it.gift_target_seat}</span>}
                {it.request && <span style={{ color: FAINT, fontSize: 11.5 }}> · {it.request}</span>}
              </span>
              <span style={{ fontWeight: 700 }}>{it.price === 0 ? '—' : `₩${(it.price * it.qty).toLocaleString()}`}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ═══ 바텀시트 공통 ═══
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(17,24,39,0.45)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxHeight: '88dvh', overflowY: 'auto', background: '#fff', borderRadius: '20px 20px 0 0', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: INK, letterSpacing: '-0.3px' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: FAINT, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const fieldLabel: React.CSSProperties = { display: 'block', fontSize: 12.5, fontWeight: 800, color: '#374151', margin: '14px 0 7px' };
const textInput: React.CSSProperties = { width: '100%', height: 46, padding: '0 14px', borderRadius: 11, border: `1px solid ${LINE}`, fontSize: 14, color: INK, outline: 'none', background: '#fff' };

function ChipRow({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(value === o ? '' : o)}
          style={{ padding: '8px 13px', borderRadius: 999, fontSize: 12.5, fontWeight: 700, border: '1px solid', borderColor: value === o ? INK : LINE, background: value === o ? INK : '#fff', color: value === o ? '#fff' : '#374151', cursor: 'pointer' }}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

// ═══ 체크인 시트 ═══
function CheckinSheet({
  slug,
  social,
  seatParam,
  onClose,
  onDone,
}: {
  slug: string;
  social: boolean;
  seatParam: string | null;
  onClose: () => void;
  onDone: (s: MySession) => void;
}) {
  const [seatLabel, setSeatLabel] = useState(seatParam ?? '');
  const [phone4, setPhone4] = useState('');
  const [gender, setGender] = useState<'m' | 'f' | ''>('');
  const [ageBand, setAgeBand] = useState('');
  const [more, setMore] = useState(false);
  const [mbti, setMbti] = useState('');
  const [purpose, setPurpose] = useState('');
  const [vibe, setVibe] = useState('');
  const [tmi, setTmi] = useState('');
  const [drinkPref, setDrinkPref] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setErr('');
    setBusy(true);
    const res = await fetch(`/api/t/${slug}/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seat_label: seatLabel,
        phone4,
        gender: gender || undefined,
        age_band: ageBand || undefined,
        mbti: mbti || undefined,
        purpose: purpose || undefined,
        vibe: vibe || undefined,
        tmi: tmi || undefined,
        drink_pref: drinkPref || undefined,
        is_public: isPublic,
      }),
    });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setErr(d.error || '체크인에 실패했어요.');
    onDone(d.session);
  };

  return (
    <Sheet title="좌석 체크인" onClose={onClose}>
      <p style={{ fontSize: 12, color: FAINT, lineHeight: 1.6, marginBottom: 4 }}>
        개인정보는 저장되지 않으며 영업 종료 후 자동 만료돼요.
      </p>

      <label style={fieldLabel}>좌석 번호</label>
      <input value={seatLabel} onChange={(e) => setSeatLabel(e.target.value)} placeholder="예: 7 (좌석 옆 번호)" inputMode="numeric" style={textInput} />

      <label style={fieldLabel}>휴대폰 뒤 4자리 <span style={{ fontWeight: 600, color: FAINT }}>(재접속용)</span></label>
      <input value={phone4} onChange={(e) => setPhone4(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="0000" inputMode="numeric" style={textInput} />

      {social && (
        <>
          <label style={fieldLabel}>성별</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {([['m', '🙋‍♂️ 남'], ['f', '🙋‍♀️ 여']] as const).map(([v, l]) => (
              <button key={v} onClick={() => setGender(v)} style={{ height: 52, borderRadius: 12, fontSize: 14.5, fontWeight: 800, border: '1.5px solid', borderColor: gender === v ? INK : LINE, background: gender === v ? INK : '#fff', color: gender === v ? '#fff' : '#374151', cursor: 'pointer' }}>
                {l}
              </button>
            ))}
          </div>

          <label style={fieldLabel}>나이대</label>
          <ChipRow options={AGE_BANDS} value={ageBand} onChange={setAgeBand} />

          <button onClick={() => setMore(!more)} style={{ marginTop: 16, background: 'none', border: 'none', fontSize: 12.5, fontWeight: 800, color: ACCENT, cursor: 'pointer', padding: 0 }}>
            {more ? '▲ 프로필 접기' : '▼ 프로필 더 채우기 (선택) — MBTI · 오늘의 목적 · TMI'}
          </button>

          {more && (
            <>
              <label style={fieldLabel}>MBTI</label>
              <ChipRow options={MBTIS} value={mbti} onChange={setMbti} />
              <label style={fieldLabel}>오늘의 목적</label>
              <ChipRow options={PURPOSES} value={purpose} onChange={setPurpose} />
              <label style={fieldLabel}>선호 분위기</label>
              <ChipRow options={VIBES} value={vibe} onChange={setVibe} />
              <label style={fieldLabel}>TMI 한 줄</label>
              <input value={tmi} onChange={(e) => setTmi(e.target.value.slice(0, 60))} placeholder="예: 오늘 처음 혼술 도전" style={textInput} />
              <label style={fieldLabel}>선호 술</label>
              <input value={drinkPref} onChange={(e) => setDrinkPref(e.target.value.slice(0, 40))} placeholder="예: 위스키, 하이볼" style={textInput} />
            </>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 18, fontSize: 13, fontWeight: 700, color: INK, cursor: 'pointer' }}>
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} style={{ width: 18, height: 18, accentColor: INK }} />
            좌석 정보 공개 <span style={{ fontWeight: 600, color: FAINT }}>(성별은 항상 공개)</span>
          </label>
        </>
      )}

      {err && <p style={{ color: '#dc2626', fontSize: 12.5, fontWeight: 700, marginTop: 12 }}>{err}</p>}

      <button onClick={submit} disabled={busy} style={{ width: '100%', height: 52, marginTop: 18, borderRadius: 13, background: INK, color: '#fff', fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
        {busy ? '체크인 중…' : '저장하고 시작하기'}
      </button>
    </Sheet>
  );
}

// ═══ 프로필 시트 ═══
function ProfileSheet({ seat, s, onClose }: { seat: Seat; s: PublicSession; onClose: () => void }) {
  const rows: [string, string | null | undefined][] = [
    ['나이대', s.age_band],
    ['MBTI', s.mbti],
    ['오늘의 목적', s.purpose],
    ['선호 분위기', s.vibe],
    ['TMI', s.tmi],
    ['선호 술', s.drink_pref],
  ];
  return (
    <Sheet title={`Seat ${seat.label} ${s.gender === 'm' ? '♂' : s.gender === 'f' ? '♀' : ''}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13.5 }}>
            <span style={{ color: MUTED, fontWeight: 700, flexShrink: 0 }}>{k}</span>
            <span style={{ color: INK, fontWeight: 700, textAlign: 'right' }}>{v}</span>
          </div>
        ))}
        {rows.every(([, v]) => !v) && <p style={{ color: FAINT, fontSize: 13, textAlign: 'center', padding: '12px 0' }}>공개된 프로필이 없어요.</p>}
      </div>
    </Sheet>
  );
}

// ═══ 장바구니 시트 ═══
function CartSheet({
  cart,
  setCart,
  total,
  busy,
  onClose,
  onSubmit,
}: {
  cart: { item: MenuItem; qty: number; request: string }[];
  setCart: React.Dispatch<React.SetStateAction<{ item: MenuItem; qty: number; request: string }[]>>;
  total: number;
  busy: boolean;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const setQty = (id: string, qty: number) =>
    setCart((prev) => (qty <= 0 ? prev.filter((c) => c.item.id !== id) : prev.map((c) => (c.item.id === id ? { ...c, qty } : c))));
  return (
    <Sheet title="주문 확인" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {cart.map((c) => (
          <div key={c.item.id} style={{ borderBottom: `1px solid #f3f4f6`, paddingBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: INK }}>{c.item.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={() => setQty(c.item.id, c.qty - 1)} style={qtyBtn}>−</button>
                <span style={{ fontSize: 14, fontWeight: 800, color: INK, minWidth: 16, textAlign: 'center' }}>{c.qty}</span>
                <button onClick={() => setQty(c.item.id, Math.min(20, c.qty + 1))} style={qtyBtn}>+</button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <input
                value={c.request}
                onChange={(e) => setCart((prev) => prev.map((x) => (x.item.id === c.item.id ? { ...x, request: e.target.value.slice(0, 100) } : x)))}
                placeholder="요청사항 (예: 얼음 적게)"
                style={{ ...textInput, height: 38, fontSize: 12.5, flex: 1 }}
              />
              <span style={{ fontSize: 13.5, fontWeight: 800, color: INK, flexShrink: 0 }}>₩{(c.item.price * c.qty).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onSubmit} disabled={busy || !cart.length} style={{ width: '100%', height: 52, marginTop: 18, borderRadius: 13, background: INK, color: '#fff', fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
        {busy ? '전송 중…' : `₩${total.toLocaleString()} 주문하기 (후불 · 카운터 결제)`}
      </button>
    </Sheet>
  );
}

const qtyBtn: React.CSSProperties = { width: 30, height: 30, borderRadius: 9, border: `1px solid ${LINE}`, background: '#fff', color: INK, fontWeight: 800, cursor: 'pointer', lineHeight: 1 };

// ═══ 선물 시트 ═══
function GiftSheet({
  item,
  seats,
  sessionBySeat,
  busy,
  onClose,
  onSend,
}: {
  item: MenuItem;
  seats: Seat[];
  sessionBySeat: Map<string, PublicSession>;
  busy: boolean;
  onClose: () => void;
  onSend: (seatLabel: string) => void;
}) {
  const [target, setTarget] = useState('');
  return (
    <Sheet title="누구에게 보낼까요?" onClose={onClose}>
      <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6, marginBottom: 14 }}>
        익명으로 전달돼요. 부담 주는 행동은 정중히 사양합니다 🙏
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {seats.map((s) => {
          const sess = sessionBySeat.get(s.id);
          return (
            <button
              key={s.id}
              onClick={() => setTarget(s.label)}
              style={{ padding: '10px 14px', borderRadius: 11, fontSize: 13.5, fontWeight: 800, border: '1.5px solid', borderColor: target === s.label ? ACCENT : LINE, background: target === s.label ? ACCENT : '#fff', color: target === s.label ? '#fff' : INK, cursor: 'pointer' }}
            >
              Seat {s.label} {sess?.gender === 'm' ? '♂' : sess?.gender === 'f' ? '♀' : ''}
            </button>
          );
        })}
      </div>
      <button onClick={() => target && onSend(target)} disabled={busy || !target} style={{ width: '100%', height: 52, marginTop: 18, borderRadius: 13, background: target ? ACCENT : '#e5e7eb', color: '#fff', fontSize: 15, fontWeight: 800, border: 'none', cursor: target ? 'pointer' : 'default', opacity: busy ? 0.6 : 1 }}>
        {busy ? '전송 중…' : `'${item.name}' 보내기`}
      </button>
    </Sheet>
  );
}

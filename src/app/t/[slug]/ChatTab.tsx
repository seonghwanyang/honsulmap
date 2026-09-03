'use client';

// 채팅 탭 — 기존 가게 채팅방(chat_rooms/chat_messages) 시스템을 테이블 페이지에서
// 소비하는 다크 스킨. 읽기는 누구나(폴링), 쓰기는 혼술맵 로그인(기존 정책 그대로)
// → 테이블 손님이 혼술맵 계정을 만나는 자연스러운 접점.
// 상단에 신청곡 큐(체크인 세션 기반, /api/t/[slug]/songs) — 마이그레이션 전엔 자동 숨김.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/client';
import LoginModal from '@/components/LoginModal';
import type { ChatMessage } from '@/lib/types';

const INK = '#f4f4f5';
const MUTED = 'rgba(255,255,255,0.55)';
const FAINT = 'rgba(255,255,255,0.42)';
const LINE = 'rgba(255,255,255,0.11)';
const ACCENT = '#a78bfa';
const ACCENT_SOLID = '#7c3aed';
const CARD = 'rgba(255,255,255,0.05)';

interface Song {
  id: string;
  seat_label: string;
  title: string;
  artist: string | null;
  status: 'queued' | 'played' | 'skipped';
  created_at: string;
}
interface Room {
  is_open: boolean;
  notice: string | null;
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0, // flex 안에서 내용폭만큼 밀고 나가 박스를 넘치는 것 방지
  height: 44,
  padding: '0 14px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.06)',
  fontSize: 14,
  color: INK,
  outline: 'none',
};

export default function ChatTab({
  spotId,
  slug,
  hasSession,
  sessionId,
  onCheckin,
}: {
  spotId: string;
  slug: string;
  hasSession: boolean;
  sessionId: string | null;
  onCheckin: () => void;
}) {
  const [room, setRoom] = useState<Room | null | 'loading'>('loading');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [uid, setUid] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [chatErr, setChatErr] = useState('');
  const [loginOpen, setLoginOpen] = useState(false);

  const [songs, setSongs] = useState<Song[]>([]);
  const [songsOn, setSongsOn] = useState(false); // 마이그레이션 전엔 숨김
  const [songOpen, setSongOpen] = useState(false);
  const [songTitle, setSongTitle] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [songBusy, setSongBusy] = useState(false);
  const [songErr, setSongErr] = useState('');

  const endRef = useRef<HTMLDivElement | null>(null);
  const countRef = useRef(0);
  const seqRef = useRef(0); // 폴링 레이스 가드 — 전송 직전 출발한 옛 응답이 새 메시지를 덮지 않게
  const tickRef = useRef(0); // 방 상태·신청곡은 3틱(12초)마다 — 메시지만 4초 유지

  useEffect(() => {
    createBrowserSupabase()
      .auth.getUser()
      .then(({ data }) => setUid(data.user?.id ?? null))
      .catch(() => setUid(null));
  }, []);

  const refresh = useCallback(async () => {
    const seq = ++seqRef.current;
    const full = tickRef.current % 3 === 0;
    tickRef.current++;
    try {
      const [roomRes, msgRes, songRes] = await Promise.all([
        full ? fetch(`/api/chat/${spotId}`, { cache: 'no-store' }) : Promise.resolve(null),
        fetch(`/api/chat/${spotId}/messages`, { cache: 'no-store' }),
        full ? fetch(`/api/t/${encodeURIComponent(slug)}/songs`, { cache: 'no-store' }) : Promise.resolve(null),
      ]);
      const roomD = roomRes && roomRes.ok ? await roomRes.json() : null;
      const msgD = msgRes.ok ? await msgRes.json() : null;
      const songD = songRes && songRes.ok ? await songRes.json() : null;
      if (seq !== seqRef.current) return; // 더 최신 폴링이 있음 — 이 응답 폐기
      if (roomD) setRoom(roomD.room ?? null);
      if (msgD) {
        const server: ChatMessage[] = msgD.messages ?? [];
        // 서버 목록에 아직 없는 로컬 최신 메시지(방금 전송분)는 보존 — 덮어쓰기 방지
        setMessages((prev) => {
          const known = new Set(server.map((m) => m.id));
          const newestServer = server[server.length - 1]?.created_at ?? '';
          const extras = prev.filter((m) => !known.has(m.id) && m.created_at >= newestServer);
          return extras.length ? [...server, ...extras] : server;
        });
      }
      if (songD) {
        setSongsOn(!!songD.available);
        setSongs(songD.songs ?? []);
      }
    } catch {
      /* 폴링 실패는 다음 틱에 복구 */
    }
  }, [spotId, slug]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  // Realtime poke — 로그인 유저는 새 메시지/삭제(UPDATE)가 오면 즉시 재조회
  // (payload엔 닉네임·배지가 없어 목록 GET으로 보강). 비로그인은 4초 폴링 그대로.
  useEffect(() => {
    if (!uid) return;
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`table-chat:${spotId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `spot_id=eq.${spotId}` },
        () => void refresh(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `spot_id=eq.${spotId}` },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [uid, spotId, refresh]);

  // 내 메시지 삭제 — 낙관적 제거, 실패 시 재조회 복구 (사장 전체 삭제는 사장님 페이지에서)
  const deleteMine = async (id: string) => {
    if (!confirm('이 메시지를 삭제할까요?')) return;
    setMessages((prev) => prev.filter((m) => m.id !== id));
    try {
      const res = await fetch(`/api/chat/${spotId}/messages/${id}`, { method: 'DELETE' });
      if (!res.ok) void refresh();
    } catch {
      void refresh();
    }
  };

  // 새 메시지 오면 맨 아래로.
  useEffect(() => {
    if (messages.length !== countRef.current) {
      countRef.current = messages.length;
      endRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [messages.length]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setChatErr('');
    const res = await fetch(`/api/chat/${spotId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text }),
    });
    setSending(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) setLoginOpen(true);
      else setChatErr(d.error || '전송에 실패했어요.');
      return;
    }
    setDraft('');
    setMessages((prev) => (prev.some((m) => m.id === d.message.id) ? prev : [...prev, d.message]));
    refresh();
  };

  const requestSong = async () => {
    const title = songTitle.trim();
    if (!title || songBusy) return;
    setSongBusy(true);
    setSongErr('');
    const res = await fetch(`/api/t/${encodeURIComponent(slug)}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, title, artist: songArtist.trim() }),
    });
    setSongBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSongErr(d.error || '신청에 실패했어요.');
      return;
    }
    setSongTitle('');
    setSongArtist('');
    setSongs((prev) => [d.song, ...prev]);
  };

  const queued = songs.filter((s) => s.status === 'queued');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 70 }}>
      {/* ── 신청곡 ── */}
      {songsOn && (
        <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 14 }}>
          <button
            onClick={() => setSongOpen(!songOpen)}
            style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: '13px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <span style={{ fontSize: 13.5, fontWeight: 800, color: INK }}>🎵 신청곡</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: queued.length ? ACCENT : FAINT }}>
              {queued.length ? `${queued.length}곡 대기 중` : '오늘 첫 곡을 신청해보세요'}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: FAINT }}>{songOpen ? '▲' : '▼'}</span>
          </button>
          {songOpen && (
            <div style={{ padding: '0 16px 14px' }}>
              {hasSession ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <input
                    value={songTitle}
                    onChange={(e) => setSongTitle(e.target.value.slice(0, 60))}
                    placeholder="곡명"
                    style={{ ...inputStyle, height: 40, fontSize: 13, width: '100%' }}
                  />
                  <div style={{ display: 'flex', gap: 7 }}>
                    <input
                      value={songArtist}
                      onChange={(e) => setSongArtist(e.target.value.slice(0, 40))}
                      placeholder="가수 (선택)"
                      style={{ ...inputStyle, height: 40, fontSize: 13 }}
                    />
                    <button
                      onClick={requestSong}
                      disabled={songBusy || !songTitle.trim()}
                      style={{ height: 40, padding: '0 16px', borderRadius: 11, background: songTitle.trim() ? '#fff' : 'rgba(255,255,255,0.12)', color: songTitle.trim() ? '#0c0c0e' : 'rgba(255,255,255,0.45)', fontSize: 12.5, fontWeight: 800, border: 'none', cursor: 'pointer', flexShrink: 0, opacity: songBusy ? 0.6 : 1 }}
                    >
                      신청
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={onCheckin} style={{ width: '100%', height: 42, borderRadius: 11, background: '#fff', color: '#0c0c0e', fontSize: 13, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
                  체크인하고 신청하기
                </button>
              )}
              {songErr && <p style={{ color: '#f87171', fontSize: 12, fontWeight: 700, marginTop: 8 }}>{songErr}</p>}
              {songs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                  {songs.slice(0, 12).map((s) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13, opacity: s.status === 'queued' ? 1 : 0.45 }}>
                      <span style={{ fontWeight: 800, color: INK, wordBreak: 'break-all' }}>
                        {s.title}
                        {s.artist && <span style={{ fontWeight: 600, color: MUTED }}> — {s.artist}</span>}
                      </span>
                      <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: 11, color: FAINT }}>Seat {s.seat_label}</span>
                      <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: s.status === 'queued' ? ACCENT : s.status === 'played' ? '#4ade80' : FAINT }}>
                        {s.status === 'queued' ? '대기' : s.status === 'played' ? '재생됨' : '패스'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 채팅 ── */}
      {room === 'loading' ? (
        <p style={{ textAlign: 'center', color: FAINT, fontSize: 13, padding: '32px 0' }}>불러오는 중…</p>
      ) : !room || !room.is_open ? (
        <div style={{ textAlign: 'center', padding: '36px 0' }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: MUTED }}>
            {!room ? '이 가게 채팅방이 아직 열리지 않았어요.' : '채팅방이 잠시 닫혀 있어요.'}
          </p>
          <p style={{ fontSize: 12.5, color: FAINT, marginTop: 6 }}>사장님이 열면 여기서 옆자리와 대화할 수 있어요 🍻</p>
        </div>
      ) : (
        <>
          {room.notice && (
            <div style={{ background: 'rgba(139,92,246,0.14)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 12, padding: '10px 14px', fontSize: 12.5, color: INK, lineHeight: 1.5 }}>
              📌 {room.notice}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 0 8px' }}>
            {messages.length === 0 && (
              <p style={{ textAlign: 'center', color: FAINT, fontSize: 13, padding: '28px 0' }}>
                아직 조용하네요. 첫 인사를 남겨보세요 🍻
              </p>
            )}
            {messages.map((m) => {
              const mine = uid !== null && m.user_id === uid;
              return (
                <div key={m.id} style={{ display: 'flex', gap: 9, flexDirection: mine ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                  {!mine && (
                    'url' in m.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.avatar.url} alt="" width={30} height={30} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: m.avatar.color, display: 'grid', placeItems: 'center', fontSize: 15, flexShrink: 0 }}>
                        {m.avatar.emoji}
                      </div>
                    )
                  )}
                  <div style={{ maxWidth: '76%' }}>
                    {!mine && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: FAINT, marginBottom: 3 }}>
                        {m.name}
                        {m.is_owner && <span style={{ marginLeft: 5, color: ACCENT, fontWeight: 800 }}>사장님</span>}
                      </div>
                    )}
                    <div
                      style={{
                        padding: '9px 13px',
                        borderRadius: mine ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
                        background: mine ? ACCENT_SOLID : CARD,
                        border: mine ? 'none' : `1px solid ${LINE}`,
                        color: mine ? '#fff' : INK,
                        fontSize: 13.5,
                        lineHeight: 1.55,
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {m.body}
                    </div>
                    {mine && (
                      <button
                        onClick={() => deleteMine(m.id)}
                        style={{ display: 'block', marginLeft: 'auto', marginTop: 3, fontSize: 10, fontWeight: 700, color: FAINT, background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: FAINT, flexShrink: 0 }}>
                    {new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          {/* 입력줄 — 하단 탭바 위 고정 (필 + 원형 전송) */}
          <div style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(66px + env(safe-area-inset-bottom))', zIndex: 30 }}>
            {chatErr && (
              <p style={{ color: '#f87171', fontSize: 12, fontWeight: 700, marginBottom: 6, textAlign: 'center', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{chatErr}</p>
            )}
            {uid ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(20,20,24,0.94)', backdropFilter: 'blur(8px)', border: `1px solid ${LINE}`, borderRadius: 999, padding: '5px 5px 5px 16px' }}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send(); }}
                  style={{ flex: 1, minWidth: 0, height: 34, border: 'none', background: 'transparent', fontSize: 14, color: INK, outline: 'none' }}
                />
                <button
                  onClick={send}
                  disabled={sending || !draft.trim()}
                  aria-label="전송"
                  style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, border: 'none', display: 'grid', placeItems: 'center', background: draft.trim() ? '#fff' : 'rgba(255,255,255,0.12)', color: draft.trim() ? '#0c0c0e' : 'rgba(255,255,255,0.4)', fontSize: 17, fontWeight: 800, cursor: 'pointer', opacity: sending ? 0.6 : 1, lineHeight: 1 }}
                >
                  ↑
                </button>
              </div>
            ) : (
              <button
                onClick={() => setLoginOpen(true)}
                style={{ width: '100%', height: 44, borderRadius: 999, background: '#fff', color: '#0c0c0e', fontSize: 13.5, fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,0,0,0.45)' }}
              >
                혼술맵 로그인하고 대화 참여하기
              </button>
            )}
          </div>
        </>
      )}

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        reason="채팅은 혼술맵 계정으로 참여해요. 익명 닉네임으로 표시돼요."
      />
    </div>
  );
}

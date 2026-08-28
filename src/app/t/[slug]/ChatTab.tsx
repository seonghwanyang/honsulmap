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

  useEffect(() => {
    createBrowserSupabase()
      .auth.getUser()
      .then(({ data }) => setUid(data.user?.id ?? null))
      .catch(() => setUid(null));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [roomRes, msgRes, songRes] = await Promise.all([
        fetch(`/api/chat/${spotId}`),
        fetch(`/api/chat/${spotId}/messages`),
        fetch(`/api/t/${encodeURIComponent(slug)}/songs`),
      ]);
      if (roomRes.ok) {
        const d = await roomRes.json();
        setRoom(d.room ?? null);
      }
      if (msgRes.ok) {
        const d = await msgRes.json();
        setMessages(d.messages ?? []);
      }
      if (songRes.ok) {
        const d = await songRes.json();
        setSongsOn(!!d.available);
        setSongs(d.songs ?? []);
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
    setMessages((prev) => [...prev, d.message]);
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
                <div style={{ display: 'flex', gap: 7 }}>
                  <input
                    value={songTitle}
                    onChange={(e) => setSongTitle(e.target.value.slice(0, 60))}
                    placeholder="곡명"
                    style={{ ...inputStyle, height: 40, fontSize: 13 }}
                  />
                  <input
                    value={songArtist}
                    onChange={(e) => setSongArtist(e.target.value.slice(0, 40))}
                    placeholder="가수 (선택)"
                    style={{ ...inputStyle, height: 40, fontSize: 13, flex: 0.8 }}
                  />
                  <button
                    onClick={requestSong}
                    disabled={songBusy || !songTitle.trim()}
                    style={{ height: 40, padding: '0 14px', borderRadius: 11, background: songTitle.trim() ? '#fff' : 'rgba(255,255,255,0.12)', color: songTitle.trim() ? '#0c0c0e' : 'rgba(255,255,255,0.45)', fontSize: 12.5, fontWeight: 800, border: 'none', cursor: 'pointer', flexShrink: 0, opacity: songBusy ? 0.6 : 1 }}
                  >
                    신청
                  </button>
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
                  </div>
                  <span style={{ fontSize: 10, color: FAINT, flexShrink: 0 }}>
                    {new Date(m.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          {/* 입력줄 — 하단 탭바 위 고정 */}
          <div style={{ position: 'fixed', left: 12, right: 12, bottom: 66, zIndex: 30, paddingBottom: 'env(safe-area-inset-bottom)' }}>
            {chatErr && (
              <p style={{ color: '#f87171', fontSize: 12, fontWeight: 700, marginBottom: 6, textAlign: 'center', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>{chatErr}</p>
            )}
            {uid ? (
              <div style={{ display: 'flex', gap: 7, background: 'rgba(14,14,17,0.9)', backdropFilter: 'blur(8px)', border: `1px solid ${LINE}`, borderRadius: 14, padding: 7 }}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 1000))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) send(); }}
                  placeholder="옆자리에 한마디…"
                  style={{ ...inputStyle, height: 40, border: 'none', background: 'transparent' }}
                />
                <button
                  onClick={send}
                  disabled={sending || !draft.trim()}
                  style={{ height: 40, padding: '0 16px', borderRadius: 11, background: draft.trim() ? '#fff' : 'rgba(255,255,255,0.12)', color: draft.trim() ? '#0c0c0e' : 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 800, border: 'none', cursor: 'pointer', flexShrink: 0, opacity: sending ? 0.6 : 1 }}
                >
                  전송
                </button>
              </div>
            ) : (
              <button
                onClick={() => setLoginOpen(true)}
                style={{ width: '100%', height: 48, borderRadius: 14, background: '#fff', color: '#0c0c0e', fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: '0 8px 28px rgba(0,0,0,0.5)' }}
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

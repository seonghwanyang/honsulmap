'use client';

// 신청곡 탭 — 체크인 세션 기반(/api/t/[slug]/songs). 채팅에서 분리(2026-09-06).
// 사장님이 신청곡을 끈 가게(또는 마이그레이션 전)는 available=false로 안내만 표시.

import { useCallback, useEffect, useRef, useState } from 'react';

const INK = '#f4f4f5';
const MUTED = 'rgba(255,255,255,0.55)';
const FAINT = 'rgba(255,255,255,0.42)';
const LINE = 'rgba(255,255,255,0.11)';
const ACCENT = '#a78bfa';
const CARD = 'rgba(255,255,255,0.05)';

interface Song {
  id: string;
  seat_label: string;
  title: string;
  artist: string | null;
  status: 'queued' | 'played' | 'skipped';
  created_at: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 48,
  padding: '0 14px',
  borderRadius: 12,
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.06)',
  fontSize: 15,
  color: INK,
  outline: 'none',
};

export default function SongsTab({
  slug,
  hasSession,
  sessionId,
  onCheckin,
}: {
  slug: string;
  hasSession: boolean;
  sessionId: string | null;
  onCheckin: () => void;
}) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const seqRef = useRef(0);

  const refresh = useCallback(async () => {
    const seq = ++seqRef.current;
    try {
      const res = await fetch(`/api/t/${encodeURIComponent(slug)}/songs`, { cache: 'no-store' });
      const d = res.ok ? await res.json() : null;
      if (seq !== seqRef.current) return;
      if (d) {
        setAvailable(!!d.available);
        setSongs(d.songs ?? []);
      }
    } catch {
      /* 다음 틱에 복구 */
    }
  }, [slug]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 6000);
    return () => clearInterval(t);
  }, [refresh]);

  const requestSong = async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    setErr('');
    const res = await fetch(`/api/t/${encodeURIComponent(slug)}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, title: t, artist: artist.trim() }),
    });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(d.error || '신청에 실패했어요.');
      return;
    }
    setTitle('');
    setArtist('');
    setSongs((prev) => [d.song, ...prev]);
  };

  const queued = songs.filter((s) => s.status === 'queued');

  if (available === false) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: MUTED }}>지금은 신청곡을 받지 않아요.</p>
        <p style={{ fontSize: 12.5, color: FAINT, marginTop: 6 }}>사장님이 열면 여기서 신청할 수 있어요 🎵</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 40 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: INK }}>🎵 신청곡</h2>
        <p style={{ fontSize: 12.5, color: FAINT, marginTop: 4 }}>
          {queued.length ? `${queued.length}곡 대기 중` : '오늘의 첫 곡을 신청해보세요'}
        </p>
      </div>

      {hasSession ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, 60))} placeholder="곡명 (예: 바람기억)" style={inputStyle} />
          <input value={artist} onChange={(e) => setArtist(e.target.value.slice(0, 40))} placeholder="가수 (선택)" style={inputStyle} />
          <button
            onClick={requestSong}
            disabled={busy || !title.trim()}
            style={{ width: '100%', height: 48, borderRadius: 12, background: title.trim() ? '#fff' : 'rgba(255,255,255,0.12)', color: title.trim() ? '#0c0c0e' : 'rgba(255,255,255,0.45)', fontSize: 14.5, fontWeight: 800, border: 'none', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
          >
            {busy ? '신청 중…' : '🎵 신청하기'}
          </button>
        </div>
      ) : (
        <button onClick={onCheckin} style={{ width: '100%', height: 48, borderRadius: 12, background: '#fff', color: '#0c0c0e', fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
          체크인하고 신청하기
        </button>
      )}
      {err && <p style={{ color: '#f87171', fontSize: 12.5, fontWeight: 700 }}>{err}</p>}

      {songs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          {songs.slice(0, 30).map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '11px 14px', borderRadius: 12, background: CARD, border: `1px solid ${LINE}`, opacity: s.status === 'queued' ? 1 : 0.5 }}>
              <span style={{ fontWeight: 800, color: INK, fontSize: 14, wordBreak: 'break-all' }}>
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
  );
}

'use client';

// 🕵️ 라이어 게임 — 각자 폰으로 방 코드 입장, 한 명만 다른 정보.
// 시민: 제시어를 안다 / 라이어: 카테고리만 안다.
// 돌아가며 한 문장씩 설명 → 투표 → (적중 시) 라이어의 단어 역추리.
// 상태는 2초 폴링, 새로고침해도 localStorage로 방 복구.

import { useCallback, useEffect, useRef, useState } from 'react';

const INK = '#111827';
const MUTED = '#6b7280';
const FAINT = '#9ca3af';
const LINE = '#e5e7eb';
const ACCENT = '#7c3aed';

const STORE_KEY = 'hsm_liar';

interface PlayerView {
  id: string;
  nick: string;
  is_host: boolean;
  voted: boolean;
}
interface RoomView {
  room: {
    code: string;
    phase: 'lobby' | 'discuss' | 'vote' | 'liar_guess' | 'done';
    category: string | null;
    round: number;
    host_player: string | null;
    accused: string | null;
    winner: 'liar' | 'citizens' | null;
    liar_guess: string | null;
    liar_player: string | null;
    word: string | null;
  };
  players: PlayerView[];
  me: { id: string; is_liar: boolean; my_vote: string | null } | null;
}

const bigBtn: React.CSSProperties = { width: '100%', height: 52, borderRadius: 13, background: INK, color: '#fff', fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer' };
const outBtn: React.CSSProperties = { width: '100%', height: 46, borderRadius: 12, background: '#fff', border: `1px solid ${LINE}`, fontSize: 13.5, fontWeight: 800, color: INK, cursor: 'pointer' };
const input: React.CSSProperties = { width: '100%', height: 48, padding: '0 14px', borderRadius: 12, border: `1.5px solid ${LINE}`, fontSize: 15, color: INK, outline: 'none' };

export default function LiarGame({ onBack, spotSlug }: { onBack: () => void; spotSlug: string }) {
  const [session, setSession] = useState<{ code: string; pid: string } | null>(null);
  const [state, setState] = useState<RoomView | null>(null);
  const [nick, setNick] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [guess, setGuess] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 세션 복구
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch {}
  }, []);

  const leave = useCallback(() => {
    localStorage.removeItem(STORE_KEY);
    setSession(null);
    setState(null);
    setMode('menu');
  }, []);

  const refresh = useCallback(async (s: { code: string; pid: string }) => {
    const res = await fetch(`/api/game/liar?code=${s.code}&pid=${s.pid}`);
    if (res.status === 404) {
      leave();
      setErr('방이 종료됐어요.');
      return;
    }
    if (res.ok) setState(await res.json());
  }, [leave]);

  // 폴링
  useEffect(() => {
    if (!session) return;
    refresh(session);
    pollRef.current = setInterval(() => refresh(session), 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [session, refresh]);

  const post = async (payload: Record<string, unknown>) => {
    setErr('');
    setBusy(true);
    const res = await fetch('/api/game/liar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(d.error || '요청에 실패했어요.');
      return null;
    }
    return d;
  };

  const create = async () => {
    const d = await post({ action: 'create', nick, spot_slug: spotSlug });
    if (!d) return;
    const s = { code: d.code, pid: d.player_id };
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
    setSession(s);
  };
  const join = async () => {
    const d = await post({ action: 'join', code: codeInput.trim(), nick });
    if (!d) return;
    const s = { code: d.code, pid: d.player_id };
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
    setSession(s);
  };
  const act = (action: string, extra: Record<string, unknown> = {}) => {
    if (!session) return;
    post({ action, code: session.code, pid: session.pid, ...extra }).then(() => refresh(session));
  };

  // ═══ 홈 (방 만들기 / 입장) ═══
  if (!session || !state) {
    return (
      <Frame title="🕵️ 라이어 게임" onBack={onBack}>
        <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.7, marginBottom: 16 }}>
          각자 폰으로 참여하는 정통 라이어 게임 (3~8명).
          <br />한 명만 제시어를 모릅니다 — 티 내지 말고 살아남으세요.
        </p>

        {mode === 'menu' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => setMode('create')} style={bigBtn}>방 만들기</button>
            <button onClick={() => setMode('join')} style={outBtn}>코드로 입장</button>
          </div>
        )}

        {mode !== 'menu' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mode === 'join' && (
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="방 코드 4자리"
                inputMode="numeric"
                style={{ ...input, textAlign: 'center', fontSize: 22, fontWeight: 800, letterSpacing: 6 }}
              />
            )}
            <input
              value={nick}
              onChange={(e) => setNick(e.target.value.slice(0, 10))}
              placeholder="닉네임"
              style={input}
            />
            <button
              onClick={mode === 'create' ? create : join}
              disabled={busy || !nick.trim() || (mode === 'join' && codeInput.length !== 4)}
              style={{ ...bigBtn, opacity: busy ? 0.6 : 1 }}
            >
              {busy ? '연결 중…' : mode === 'create' ? '방 만들기' : '입장하기'}
            </button>
            <button onClick={() => setMode('menu')} style={{ background: 'none', border: 'none', fontSize: 12.5, fontWeight: 700, color: FAINT, cursor: 'pointer' }}>
              ← 뒤로
            </button>
          </div>
        )}
        {err && <p style={{ color: '#dc2626', fontSize: 12.5, fontWeight: 700, marginTop: 12 }}>{err}</p>}
      </Frame>
    );
  }

  const { room, players, me } = state;
  const isHost = me?.id === room.host_player;
  const votedCount = players.filter((p) => p.voted).length;
  const liarNick = players.find((p) => p.id === room.liar_player)?.nick;
  const accusedNick = players.find((p) => p.id === room.accused)?.nick;

  return (
    <Frame title="🕵️ 라이어 게임" onBack={() => { if (confirm('방에서 나갈까요?')) { leave(); onBack(); } }}>
      {/* 방 정보 바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: MUTED }}>방 코드</span>
        <span style={{ fontSize: 20, fontWeight: 800, color: INK, letterSpacing: 4 }}>{room.code}</span>
        {room.round > 0 && <span style={{ fontSize: 11.5, fontWeight: 700, color: FAINT }}>· {room.round}라운드</span>}
        <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: FAINT }}>{players.length}명</span>
      </div>

      {/* ── 로비 ── */}
      {room.phase === 'lobby' && (
        <>
          <div style={{ borderRadius: 16, border: `2px dashed ${LINE}`, padding: '18px 16px', textAlign: 'center', marginBottom: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: MUTED, lineHeight: 1.7 }}>
              친구들에게 코드 <b style={{ color: ACCENT }}>{room.code}</b> 를 알려주세요
              <br />같은 페이지 → 라이어 게임 → 코드로 입장
            </p>
          </div>
          <PlayerChips players={players} meId={me?.id} />
          {isHost ? (
            <button onClick={() => act('start')} disabled={busy || players.length < 3} style={{ ...bigBtn, marginTop: 16, opacity: players.length < 3 ? 0.5 : 1 }}>
              {players.length < 3 ? `시작하려면 ${3 - players.length}명 더` : '게임 시작!'}
            </button>
          ) : (
            <p style={{ textAlign: 'center', fontSize: 13, color: FAINT, fontWeight: 700, marginTop: 16 }}>방장이 시작하길 기다리는 중…</p>
          )}
        </>
      )}

      {/* ── 토론 (역할 카드) ── */}
      {room.phase === 'discuss' && (
        <>
          {me?.is_liar ? (
            <div style={{ borderRadius: 18, background: INK, padding: '28px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 34 }}>🤫</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: '#fff', marginTop: 8 }}>당신이 라이어!</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#a78bfa', marginTop: 10 }}>
                카테고리: {room.category}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 10, lineHeight: 1.6 }}>
                제시어를 아는 척 자연스럽게 설명하세요.
                <br />들키면 마지막 역추리 기회가 있습니다.
              </div>
            </div>
          ) : (
            <div style={{ borderRadius: 18, border: `2px solid ${ACCENT}`, background: '#fff', padding: '28px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT }}>{room.category}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: INK, marginTop: 6 }}>{room.word}</div>
              <div style={{ fontSize: 12, color: FAINT, marginTop: 10, lineHeight: 1.6 }}>
                라이어에게 들키지 않게, 너무 쉽지도 어렵지도 않게 설명하세요.
              </div>
            </div>
          )}
          <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.7, margin: '14px 2px 0', fontWeight: 600 }}>
            🗣 돌아가며 <b>한 문장씩</b> 제시어를 설명합니다. 다 돌았으면 토론 후 투표!
          </p>
          {isHost && (
            <button onClick={() => act('open_vote')} disabled={busy} style={{ ...bigBtn, marginTop: 14 }}>
              🗳 투표 열기
            </button>
          )}
        </>
      )}

      {/* ── 투표 ── */}
      {room.phase === 'vote' && (
        <>
          <p style={{ fontSize: 13.5, fontWeight: 800, color: INK, marginBottom: 10 }}>
            라이어라고 생각하는 사람을 지목하세요 ({votedCount}/{players.length} 완료)
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {players.filter((p) => p.id !== me?.id).map((p) => {
              const picked = me?.my_vote === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => act('vote', { target: p.id })}
                  disabled={busy}
                  style={{ height: 52, borderRadius: 12, fontSize: 14.5, fontWeight: 800, border: '1.5px solid', borderColor: picked ? ACCENT : LINE, background: picked ? ACCENT : '#fff', color: picked ? '#fff' : INK, cursor: 'pointer' }}
                >
                  {p.nick} {picked && '✓'}
                </button>
              );
            })}
          </div>
          <p style={{ fontSize: 11.5, color: FAINT, fontWeight: 600, marginTop: 10, textAlign: 'center' }}>
            전원 투표하면 자동으로 결과가 공개됩니다 (동표면 라이어 승리)
          </p>
        </>
      )}

      {/* ── 라이어 역추리 ── */}
      {room.phase === 'liar_guess' && (
        <>
          <div style={{ borderRadius: 16, background: '#fef3c7', border: '2px solid #f59e0b', padding: '18px 16px', textAlign: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#92400e' }}>
              🎯 {accusedNick} 지목 — 라이어 적중!
            </div>
            <div style={{ fontSize: 12, color: '#a16207', marginTop: 4 }}>
              하지만 라이어가 제시어를 맞히면 역전승…
            </div>
          </div>
          {me?.is_liar ? (
            <>
              <input
                value={guess}
                onChange={(e) => setGuess(e.target.value.slice(0, 30))}
                placeholder={`제시어를 맞혀보세요 (${room.category})`}
                style={input}
              />
              <button onClick={() => act('guess', { text: guess })} disabled={busy || !guess.trim()} style={{ ...bigBtn, marginTop: 10 }}>
                이거다! 역추리 제출
              </button>
            </>
          ) : (
            <p style={{ textAlign: 'center', fontSize: 13.5, color: MUTED, fontWeight: 700, padding: '14px 0' }}>
              {liarNick ?? '라이어'}가 마지막 추리 중… 🫣
            </p>
          )}
        </>
      )}

      {/* ── 결과 ── */}
      {room.phase === 'done' && (
        <>
          <div style={{ borderRadius: 18, border: `2px solid ${room.winner === 'liar' ? INK : ACCENT}`, background: room.winner === 'liar' ? INK : '#fff', padding: '26px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 34 }}>{room.winner === 'liar' ? '😈' : '🎉'}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: room.winner === 'liar' ? '#fff' : INK, marginTop: 8 }}>
              {room.winner === 'liar' ? '라이어 승리!' : '시민 승리!'}
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: room.winner === 'liar' ? '#a78bfa' : ACCENT, marginTop: 10 }}>
              라이어는 {liarNick} · 제시어는 &quot;{room.word}&quot;
            </div>
            {room.liar_guess && (
              <div style={{ fontSize: 12, color: room.winner === 'liar' ? '#9ca3af' : MUTED, marginTop: 6 }}>
                라이어의 추리: &quot;{room.liar_guess}&quot;
              </div>
            )}
          </div>
          <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 800, color: MUTED, margin: '14px 0' }}>
            {room.winner === 'liar' ? '속은 시민들 다 같이 한 잔 🍻' : `${liarNick}, 벌칙주 한 잔 🍻`}
          </p>
          {isHost && (
            <button onClick={() => act('again')} disabled={busy} style={bigBtn}>
              한 판 더 (새 제시어)
            </button>
          )}
          <button onClick={() => { leave(); }} style={{ ...outBtn, marginTop: 8 }}>
            방 나가기
          </button>
        </>
      )}

      {err && <p style={{ color: '#dc2626', fontSize: 12.5, fontWeight: 700, marginTop: 12 }}>{err}</p>}
    </Frame>
  );
}

function PlayerChips({ players, meId }: { players: PlayerView[]; meId?: string }) {
  return (
    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
      {players.map((p) => (
        <span
          key={p.id}
          style={{ padding: '8px 13px', borderRadius: 999, fontSize: 13, fontWeight: 800, background: p.id === meId ? INK : '#f3f4f6', color: p.id === meId ? '#fff' : INK }}
        >
          {p.is_host && '👑 '}
          {p.nick}
          {p.id === meId && ' (나)'}
        </span>
      ))}
    </div>
  );
}

function Frame({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div>
      <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 800, color: MUTED, cursor: 'pointer', padding: '0 0 12px' }}>
        ← 게임 목록
      </button>
      <h2 style={{ fontSize: 18, fontWeight: 800, color: INK, marginBottom: 14 }}>{title}</h2>
      {children}
    </div>
  );
}

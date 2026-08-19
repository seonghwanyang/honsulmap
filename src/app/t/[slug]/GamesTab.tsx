'use client';

// 술게임 — 도감(규칙)이 아니라 폰 1대로 바로 도는 플레이 툴.
// 결과 화면의 "벌칙주 고르러 가기"가 메뉴 탭으로 연결된다 (게임→매출 고리).

import { useEffect, useRef, useState } from 'react';

const INK = '#111827';
const MUTED = '#6b7280';
const FAINT = '#9ca3af';
const LINE = '#e5e7eb';
const ACCENT = '#7c3aed';

const QUESTIONS = [
  '오늘 혼술/술자리 나온 진짜 이유는?',
  '최근에 제일 창피했던 순간은?',
  '이상형을 세 단어로 말하면?',
  '인생 최고의 술안주는?',
  '지금 옆 사람 첫인상 솔직하게?',
  '휴대폰에서 마지막으로 검색한 것은?',
  '살면서 제일 잘한 소비는?',
  '요즘 나를 제일 웃게 하는 것은?',
  '술버릇 솔직하게 고백하기',
  '내일 지구가 망하면 오늘 뭐 할래?',
  '첫사랑 이야기 30초 요약',
  '나의 TMI 하나 공개하기',
];

const RULES: { title: string; people: string; tags: string[]; body: string; penalty: string }[] = [
  { title: '메두사 게임', people: '3~8명', tags: ['입문', '텐션업'], body: '모두 고개를 숙였다가 "하나 둘 셋!"에 동시에 한 사람을 바라본다. 서로 눈이 마주친 사람끼리 짠하고 마신다. 아무도 안 마주치면 다시.', penalty: '같이 한 잔' },
  { title: '양세찬 게임', people: '3~6명', tags: ['입문', '처음 만난 사람'], body: '각자 이마에 인물 이름을 붙이고, 질문을 던져 자기 이마의 인물을 맞힌다. 못 맞히고 턴이 끝나면 마신다.', penalty: '한 잔' },
  { title: '폭탄 돌리기', people: '3~8명', tags: ['텐션업'], body: '폭탄 타이머를 켜고 질문에 답하며 폰을 옆으로 넘긴다. 터질 때 들고 있는 사람이 마신다. (아래 폭탄 타이머로 바로 플레이)', penalty: '데킬라 또는 같이 한 잔' },
  { title: '랭킹 게임', people: '4~8명', tags: ['처음 만난 사람', '텐션업'], body: '술래를 정하고 나머지끼리 특정 순위를 몰래 합의한다(예: 가장 늦게 결혼할 것 같은 사람). 술래가 순위를 추측해서 맞히면 통과, 틀리면 마신다.', penalty: '한 잔' },
  { title: '빙고 게임', people: '3~6명', tags: ['입문', '단체'], body: '주제를 정하고 3x3 빙고판을 그린다. 돌아가며 단어를 말하고, 마지막까지 빙고를 못 만든 사람이 마신다.', penalty: '벌주 한 잔' },
];

type Tool = 'home' | 'roulette' | 'bomb' | 'ladder' | 'cards' | 'rules';

export default function GamesTab({ onGoMenu }: { onGoMenu: () => void }) {
  const [tool, setTool] = useState<Tool>('home');
  if (tool === 'roulette') return <Roulette onBack={() => setTool('home')} onGoMenu={onGoMenu} />;
  if (tool === 'bomb') return <Bomb onBack={() => setTool('home')} onGoMenu={onGoMenu} />;
  if (tool === 'ladder') return <Ladder onBack={() => setTool('home')} onGoMenu={onGoMenu} />;
  if (tool === 'cards') return <Cards onBack={() => setTool('home')} />;
  if (tool === 'rules') return <Rules onBack={() => setTool('home')} />;

  const items: { key: Tool; emoji: string; title: string; desc: string }[] = [
    { key: 'roulette', emoji: '🎯', title: '벌칙 룰렛', desc: '이름 넣고 돌리면 오늘의 희생자 결정' },
    { key: 'bomb', emoji: '💣', title: '폭탄 타이머', desc: '터질 때 들고 있는 사람이 마신다' },
    { key: 'ladder', emoji: '🪜', title: '사다리타기', desc: '벌칙·계산 담당 공정하게 뽑기' },
    { key: 'cards', emoji: '🃏', title: '질문 카드', desc: '어색할 때 한 장씩 — 아이스브레이킹' },
    { key: 'rules', emoji: '📖', title: '술게임 도감', desc: '메두사·양세찬·랭킹… 규칙 모음' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((g) => (
        <button key={g.key} onClick={() => setTool(g.key)} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '15px 16px', cursor: 'pointer' }}>
          <span style={{ fontSize: 26 }}>{g.emoji}</span>
          <span>
            <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: INK }}>{g.title}</span>
            <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{g.desc}</span>
          </span>
        </button>
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

function PenaltyCta({ name, onGoMenu }: { name: string; onGoMenu: () => void }) {
  return (
    <button onClick={onGoMenu} style={{ width: '100%', height: 48, marginTop: 14, borderRadius: 12, background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
      🍹 {name}의 벌칙주 고르러 가기
    </button>
  );
}

function NameChips({ names, setNames }: { names: string[]; setNames: (n: string[]) => void }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim().slice(0, 10);
    if (v && !names.includes(v) && names.length < 8) setNames([...names, v]);
    setInput('');
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="이름 입력 (최대 8명)"
          style={{ flex: 1, height: 46, padding: '0 14px', borderRadius: 11, border: `1px solid ${LINE}`, fontSize: 14, outline: 'none', color: INK }}
        />
        <button onClick={add} style={{ width: 64, borderRadius: 11, background: INK, color: '#fff', fontSize: 13.5, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
          추가
        </button>
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
        {names.map((n) => (
          <button key={n} onClick={() => setNames(names.filter((x) => x !== n))} style={{ padding: '7px 12px', borderRadius: 999, background: '#f3f4f6', border: 'none', fontSize: 13, fontWeight: 700, color: INK, cursor: 'pointer' }}>
            {n} ×
          </button>
        ))}
      </div>
    </div>
  );
}

// 🎯 벌칙 룰렛 — 이름들이 빠르게 돌다가 감속하며 한 명에 멈춤
function Roulette({ onBack, onGoMenu }: { onBack: () => void; onGoMenu: () => void }) {
  const [names, setNames] = useState<string[]>([]);
  const [current, setCurrent] = useState('');
  const [winner, setWinner] = useState('');
  const [spinning, setSpinning] = useState(false);

  const spin = () => {
    if (names.length < 2 || spinning) return;
    setWinner('');
    setSpinning(true);
    const target = names[Math.floor(Math.random() * names.length)];
    let i = 0;
    let delay = 60;
    const tick = () => {
      setCurrent(names[i % names.length]);
      i++;
      if (delay > 320 && names[(i - 1) % names.length] === target) {
        setWinner(target);
        setSpinning(false);
        if (navigator.vibrate) navigator.vibrate([80, 40, 120]);
        return;
      }
      delay = Math.min(360, delay * 1.13);
      setTimeout(tick, delay);
    };
    tick();
  };

  return (
    <Frame title="🎯 벌칙 룰렛" onBack={onBack}>
      <NameChips names={names} setNames={setNames} />
      <div style={{ margin: '22px 0', height: 110, borderRadius: 16, border: `2px solid ${winner ? ACCENT : LINE}`, background: '#fff', display: 'grid', placeItems: 'center' }}>
        <span style={{ fontSize: winner ? 30 : 24, fontWeight: 800, color: winner ? ACCENT : INK }}>
          {winner ? `${winner} 당첨!` : current || '?'}
        </span>
      </div>
      <button onClick={spin} disabled={names.length < 2 || spinning} style={{ width: '100%', height: 52, borderRadius: 13, background: names.length < 2 ? '#e5e7eb' : INK, color: '#fff', fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
        {spinning ? '돌아가는 중…' : '돌리기!'}
      </button>
      {winner && <PenaltyCta name={winner} onGoMenu={onGoMenu} />}
    </Frame>
  );
}

// 💣 폭탄 타이머 — 랜덤 20~75초, 남은 시간 비공개
function Bomb({ onBack, onGoMenu }: { onBack: () => void; onGoMenu: () => void }) {
  const [state, setState] = useState<'idle' | 'ticking' | 'boom'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const start = () => {
    setState('ticking');
    const ms = (20 + Math.random() * 55) * 1000;
    timer.current = setTimeout(() => {
      setState('boom');
      if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 500]);
    }, ms);
  };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <Frame title="💣 폭탄 타이머" onBack={onBack}>
      <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginBottom: 18 }}>
        시작을 누르고 질문에 답하며 폰을 옆으로 넘기세요. 언제 터질지는 아무도 몰라요 (20~75초).
      </p>
      {state === 'idle' && (
        <button onClick={start} style={{ width: '100%', height: 120, borderRadius: 18, background: INK, color: '#fff', fontSize: 20, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
          💣 시작 — 폰 돌리기!
        </button>
      )}
      {state === 'ticking' && (
        <div style={{ height: 180, borderRadius: 18, background: '#fff7ed', border: '2px solid #fdba74', display: 'grid', placeItems: 'center' }}>
          <span className="animate-pulse" style={{ fontSize: 44 }}>💣</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#c2410c' }}>돌려! 돌려! 돌려!</span>
        </div>
      )}
      {state === 'boom' && (
        <>
          <div style={{ height: 180, borderRadius: 18, background: '#fef2f2', border: '2px solid #ef4444', display: 'grid', placeItems: 'center' }}>
            <span style={{ fontSize: 52 }}>💥</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>펑! 들고 있는 사람 당첨!</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={() => setState('idle')} style={{ flex: 1, height: 48, borderRadius: 12, background: '#fff', border: `1px solid ${LINE}`, fontSize: 14, fontWeight: 800, color: INK, cursor: 'pointer' }}>
              다시 하기
            </button>
          </div>
          <PenaltyCta name="당첨자" onGoMenu={onGoMenu} />
        </>
      )}
    </Frame>
  );
}

// 🪜 사다리타기 — 한 명만 당첨 (벌칙/계산 담당)
function Ladder({ onBack, onGoMenu }: { onBack: () => void; onGoMenu: () => void }) {
  const [names, setNames] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const winnerRef = useRef('');

  const shuffle = () => {
    if (names.length < 2) return;
    winnerRef.current = names[Math.floor(Math.random() * names.length)];
    setOpened(new Set());
    setRevealed('ready');
  };

  return (
    <Frame title="🪜 사다리타기" onBack={onBack}>
      <NameChips names={names} setNames={setNames} />
      {revealed !== 'ready' ? (
        <button onClick={shuffle} disabled={names.length < 2} style={{ width: '100%', height: 52, marginTop: 20, borderRadius: 13, background: names.length < 2 ? '#e5e7eb' : INK, color: '#fff', fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
          사다리 섞기
        </button>
      ) : (
        <>
          <p style={{ fontSize: 12.5, color: MUTED, margin: '18px 0 10px', fontWeight: 700 }}>각자 자기 이름을 눌러 결과를 확인하세요 👇</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {names.map((n) => {
              const open = opened.has(n);
              const isWinner = n === winnerRef.current;
              return (
                <button
                  key={n}
                  onClick={() => setOpened((prev) => new Set(prev).add(n))}
                  style={{ height: 64, borderRadius: 12, fontSize: 14.5, fontWeight: 800, border: '1.5px solid', borderColor: open ? (isWinner ? ACCENT : LINE) : INK, background: open ? (isWinner ? ACCENT : '#f8f9fa') : '#fff', color: open ? (isWinner ? '#fff' : FAINT) : INK, cursor: 'pointer' }}
                >
                  {open ? (isWinner ? `${n} 🍺 당첨!` : `${n} · 통과`) : n}
                </button>
              );
            })}
          </div>
          <button onClick={shuffle} style={{ width: '100%', height: 44, marginTop: 12, borderRadius: 11, background: '#fff', border: `1px solid ${LINE}`, fontSize: 13, fontWeight: 800, color: INK, cursor: 'pointer' }}>
            다시 섞기
          </button>
          {[...opened].includes(winnerRef.current) && <PenaltyCta name={winnerRef.current} onGoMenu={onGoMenu} />}
        </>
      )}
    </Frame>
  );
}

// 🃏 질문 카드
function Cards({ onBack }: { onBack: () => void }) {
  const [q, setQ] = useState('');
  const [used, setUsed] = useState<Set<number>>(new Set());
  const draw = () => {
    const remain = QUESTIONS.map((_, i) => i).filter((i) => !used.has(i));
    const pool = remain.length ? remain : QUESTIONS.map((_, i) => i);
    if (!remain.length) setUsed(new Set());
    const pick = pool[Math.floor(Math.random() * pool.length)];
    setUsed((prev) => new Set(prev).add(pick));
    setQ(QUESTIONS[pick]);
  };
  return (
    <Frame title="🃏 질문 카드" onBack={onBack}>
      <div style={{ minHeight: 150, borderRadius: 18, background: '#fff', border: `2px solid ${q ? ACCENT : LINE}`, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center' }}>
        <span style={{ fontSize: q ? 18 : 14, fontWeight: 800, color: q ? INK : FAINT, lineHeight: 1.5 }}>
          {q || '카드를 뽑아서 나온 질문에 답해요.\n답 못 하면 마시기!'}
        </span>
      </div>
      <button onClick={draw} style={{ width: '100%', height: 52, marginTop: 16, borderRadius: 13, background: INK, color: '#fff', fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
        카드 뽑기
      </button>
    </Frame>
  );
}

// 📖 도감
function Rules({ onBack }: { onBack: () => void }) {
  return (
    <Frame title="📖 술게임 도감" onBack={onBack}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {RULES.map((r) => (
          <div key={r.title} style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14.5, fontWeight: 800, color: INK }}>{r.title}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: FAINT }}>{r.people}</span>
              {r.tags.map((t) => (
                <span key={t} style={{ fontSize: 10.5, fontWeight: 800, color: ACCENT, background: '#f5f3ff', borderRadius: 6, padding: '2px 7px' }}>
                  #{t}
                </span>
              ))}
            </div>
            <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.7, marginTop: 7 }}>{r.body}</p>
            <p style={{ fontSize: 11.5, color: FAINT, fontWeight: 700, marginTop: 5 }}>벌칙: {r.penalty}</p>
          </div>
        ))}
      </div>
    </Frame>
  );
}

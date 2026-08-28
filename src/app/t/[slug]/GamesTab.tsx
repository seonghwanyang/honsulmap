'use client';

// 혼술바 게임 탭 — 아이스브레이킹이 본질.
// 대화 게임(WNRS×아론 3단계 구조)이 메인, 벌칙 게임은 서브.
// 멀티폰 동기화가 필요한 게임(라이어·바 전체 판)은 잠금 타일로 예고.

import { useEffect, useRef, useState } from 'react';
import LiarGame from './LiarGame';
import {
  TALK_LV1,
  TALK_LV2,
  TALK_LV3,
  BALANCE,
  FIRST_IMPRESSION,
  NEVER_EVER,
  shuffle,
} from './gamesData';

const INK = '#f4f4f5';
const MUTED = 'rgba(255,255,255,0.55)';
const FAINT = 'rgba(255,255,255,0.42)';
const LINE = 'rgba(255,255,255,0.12)';
const ACCENT = '#a78bfa';
const ACCENT_SOLID = '#7c3aed';

const QUESTIONS_TO_UNLOCK = 6; // 레벨당 이만큼 답하면 다음 레벨 해금 (WNRS 룰 축소판)

const RULES: { title: string; people: string; tags: string[]; body: string; penalty: string }[] = [
  { title: '메두사 게임', people: '3~8명', tags: ['입문', '텐션업'], body: '모두 고개를 숙였다가 "하나 둘 셋!"에 동시에 한 사람을 바라본다. 서로 눈이 마주친 사람끼리 짠하고 마신다. 아무도 안 마주치면 다시.', penalty: '같이 한 잔' },
  { title: '양세찬 게임', people: '3~6명', tags: ['입문', '처음 만난 사람'], body: '각자 이마에 인물 이름을 붙이고, 질문을 던져 자기 이마의 인물을 맞힌다. 못 맞히고 턴이 끝나면 마신다.', penalty: '한 잔' },
  { title: '폭탄 돌리기', people: '3~8명', tags: ['텐션업'], body: '폭탄 타이머를 켜고 질문에 답하며 폰을 옆으로 넘긴다. 터질 때 들고 있는 사람이 마신다. (폭탄 타이머로 바로 플레이)', penalty: '데킬라 또는 같이 한 잔' },
  { title: '랭킹 게임', people: '4~8명', tags: ['처음 만난 사람', '텐션업'], body: '술래를 정하고 나머지끼리 특정 순위를 몰래 합의한다(예: 가장 늦게 결혼할 것 같은 사람). 술래가 순위를 추측해서 맞히면 통과, 틀리면 마신다.', penalty: '한 잔' },
  { title: '빙고 게임', people: '3~6명', tags: ['입문', '단체'], body: '주제를 정하고 3x3 빙고판을 그린다. 돌아가며 단어를 말하고, 마지막까지 빙고를 못 만든 사람이 마신다.', penalty: '벌주 한 잔' },
];

type Tool =
  | 'home'
  | 'liar'
  | 'talk'
  | 'telepathy'
  | 'impression'
  | 'never'
  | 'eye'
  | 'roulette'
  | 'bomb'
  | 'ladder'
  | 'rules';

export default function GamesTab({ onGoMenu, spotSlug }: { onGoMenu: () => void; spotSlug: string }) {
  const [tool, setTool] = useState<Tool>('home');
  const back = () => setTool('home');

  if (tool === 'liar') return <LiarGame onBack={back} spotSlug={spotSlug} />;
  if (tool === 'talk') return <TalkCards onBack={back} onEye={() => setTool('eye')} />;
  if (tool === 'telepathy') return <Telepathy onBack={back} />;
  if (tool === 'impression') return <FirstImpression onBack={back} />;
  if (tool === 'never') return <NeverEver onBack={back} />;
  if (tool === 'eye') return <EyeContact onBack={back} />;
  if (tool === 'roulette') return <Roulette onBack={back} onGoMenu={onGoMenu} />;
  if (tool === 'bomb') return <Bomb onBack={back} onGoMenu={onGoMenu} />;
  if (tool === 'ladder') return <Ladder onBack={back} onGoMenu={onGoMenu} />;
  if (tool === 'rules') return <Rules onBack={back} />;

  const talk: { key: Tool; emoji: string; title: string; desc: string }[] = [
    { key: 'talk', emoji: '🗣', title: '대화 카드', desc: '얕은 물부터 딥토크까지 — 3단계 질문으로 말 트기' },
    { key: 'telepathy', emoji: '🔮', title: '텔레파시 밸런스', desc: '동시에 골라서 통하면 통과, 어긋나면 같이 한 잔' },
    { key: 'impression', emoji: '👀', title: '첫인상 퀴즈', desc: '상대를 얼마나 읽었나 — 첫인상 맞히기 10문항' },
    { key: 'never', emoji: '🙅', title: '한번도 게임', desc: '나는 한 번도 ○○한 적 없다 — 해당되면 접고 마시기' },
    { key: 'eye', emoji: '👁', title: '눈맞춤 챌린지', desc: '말없이 1분 — 웃거나 눈 돌리면 패배' },
  ];
  const party: { key: Tool; emoji: string; title: string; desc: string }[] = [
    { key: 'roulette', emoji: '🎯', title: '벌칙 룰렛', desc: '이름 넣고 돌리면 오늘의 희생자 결정' },
    { key: 'bomb', emoji: '💣', title: '폭탄 타이머', desc: '터질 때 들고 있는 사람이 마신다' },
    { key: 'ladder', emoji: '🪜', title: '사다리타기', desc: '벌칙·계산 담당 공정하게 뽑기' },
    { key: 'rules', emoji: '📖', title: '술게임 도감', desc: '메두사·양세찬·랭킹… 규칙 모음' },
  ];
  const locked: { emoji: string; title: string; desc: string }[] = [
    { emoji: '🤫', title: 'TMI 맞히기', desc: '이 바의 익명 TMI, 누구 것인지 투표' },
    { emoji: '💬', title: '오늘의 질문', desc: '바 전체가 같은 질문에 익명으로 답하기' },
    { emoji: '🎲', title: '휴먼 빙고', desc: '"INFP 있다" — 물어봐야 채워지는 빙고' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Section2 label="📱 각자 폰으로 — 다 같이 접속">
        <GameCard emoji="🕵️" title="라이어 게임" desc="방 코드로 모여요 — 한 명만 제시어를 모른다 (3~8명)" onClick={() => setTool('liar')} />
      </Section2>

      <Section2 label="🍸 말 트기 — 옆자리와">
        {talk.map((g) => (
          <GameCard key={g.key} emoji={g.emoji} title={g.title} desc={g.desc} onClick={() => setTool(g.key)} />
        ))}
      </Section2>

      <Section2 label="🍻 다 같이 — 텐션업">
        {party.map((g) => (
          <GameCard key={g.key} emoji={g.emoji} title={g.title} desc={g.desc} onClick={() => setTool(g.key)} />
        ))}
      </Section2>

      <Section2 label="🔒 곧 열려요 — 혼술맵 앱 전용">
        {locked.map((g) => (
          <div
            key={g.title}
            style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(255,255,255,0.05)', border: `1px dashed rgba(255,255,255,0.24)`, borderRadius: 14, padding: '14px 16px', opacity: 0.65 }}
          >
            <span style={{ fontSize: 24, filter: 'grayscale(0.5)' }}>{g.emoji}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: INK }}>{g.title}</span>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: '#fcd34d', background: 'rgba(245,158,11,0.15)', borderRadius: 5, padding: '2px 6px' }}>준비 중</span>
              </span>
              <span style={{ display: 'block', fontSize: 11.5, color: FAINT, marginTop: 2 }}>{g.desc}</span>
            </span>
          </div>
        ))}
      </Section2>
    </div>
  );
}

function Section2({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 style={{ fontSize: 12.5, fontWeight: 800, color: MUTED, margin: '2px 2px 8px' }}>{label}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </section>
  );
}

function GameCard({ emoji, title, desc, onClick }: { emoji: string; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(255,255,255,0.05)', border: `1px solid ${LINE}`, borderRadius: 14, padding: '14px 16px', cursor: 'pointer' }}>
      <span style={{ fontSize: 25 }}>{emoji}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800, color: INK }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12, color: MUTED, marginTop: 2 }}>{desc}</span>
      </span>
    </button>
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
    <button onClick={onGoMenu} style={{ width: '100%', height: 48, marginTop: 14, borderRadius: 12, background: ACCENT_SOLID, color: '#fff', fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
      🍹 {name}의 벌칙주 고르러 가기
    </button>
  );
}

const bigBtn: React.CSSProperties = { width: '100%', height: 52, borderRadius: 13, background: '#fff', color: '#0c0c0e', fontSize: 15, fontWeight: 800, border: 'none', cursor: 'pointer' };
const outBtn: React.CSSProperties = { width: '100%', height: 46, borderRadius: 12, background: 'rgba(255,255,255,0.07)', border: `1px solid ${LINE}`, fontSize: 13.5, fontWeight: 800, color: INK, cursor: 'pointer' };

// ═══ 🗣 대화 카드 — WNRS×아론 3단계 ═══
function TalkCards({ onBack, onEye }: { onBack: () => void; onEye: () => void }) {
  const LEVELS: { no: 1 | 2 | 3; name: string; desc: string; bank: readonly string[] }[] = [
    { no: 1, name: '얕은 물', desc: '첫인상 · 취향', bank: TALK_LV1 },
    { no: 2, name: '연결', desc: '경험 · 가치관', bank: TALK_LV2 },
    { no: 3, name: '딥토크', desc: '성찰 · 솔직', bank: TALK_LV3 },
  ];
  const decksRef = useRef<Record<number, string[]>>({});
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const [unlocked, setUnlocked] = useState<1 | 2 | 3>(1);
  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState<Record<number, number>>({ 1: 0, 2: 0, 3: 0 });
  const [turn, setTurn] = useState<0 | 1>(0);
  const [passes, setPasses] = useState(0);

  if (!decksRef.current[1]) {
    decksRef.current = { 1: shuffle(TALK_LV1), 2: shuffle(TALK_LV2), 3: shuffle(TALK_LV3) };
  }
  const deck = decksRef.current[level]!;
  const card = deck[idx % deck.length];
  const done = answered[level] ?? 0;
  const canUnlockNext = level === unlocked && level < 3 && done >= QUESTIONS_TO_UNLOCK;
  const lv3Finished = level === 3 && done >= deck.length;

  const advance = (passed: boolean) => {
    setAnswered((prev) => ({ ...prev, [level]: (prev[level] ?? 0) + 1 }));
    setIdx((i) => i + 1);
    setTurn((t) => (t === 0 ? 1 : 0));
    if (passed) setPasses((p) => p + 1);
  };

  const goLevel = (no: 1 | 2 | 3) => {
    setLevel(no);
    setIdx(0);
  };

  return (
    <Frame title="🗣 대화 카드" onBack={onBack}>
      <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginBottom: 12 }}>
        번갈아 <b>둘 다</b> 답해요 — 서로 주고받아야 가까워집니다.
        <br />
        답하기 곤란하면 패스 = 같이 한 잔 🍻
      </p>

      {/* 레벨 선택 */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 14 }}>
        {LEVELS.map((l) => {
          const isLocked = l.no > unlocked;
          const active = level === l.no;
          return (
            <button
              key={l.no}
              onClick={() => !isLocked && goLevel(l.no)}
              style={{ flex: 1, padding: '9px 4px', borderRadius: 11, border: '1.5px solid', borderColor: active ? INK : LINE, background: active ? '#fff' : 'rgba(255,255,255,0.07)', color: isLocked ? FAINT : active ? '#0c0c0e' : INK, cursor: isLocked ? 'default' : 'pointer' }}
            >
              <span style={{ display: 'block', fontSize: 12.5, fontWeight: 800 }}>
                {isLocked ? '🔒 ' : ''}Lv{l.no} {l.name}
              </span>
              <span style={{ display: 'block', fontSize: 9.5, fontWeight: 600, opacity: 0.75, marginTop: 1 }}>{l.desc}</span>
            </button>
          );
        })}
      </div>

      {/* 카드 */}
      <div style={{ minHeight: 170, borderRadius: 18, background: level === 3 ? '#fff' : 'rgba(255,255,255,0.05)', border: `2px solid ${level === 3 ? INK : ACCENT}`, display: 'grid', placeItems: 'center', padding: '26px 22px', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: level === 3 ? ACCENT_SOLID : ACCENT, marginBottom: 10 }}>
            {turn === 0 ? '🅰 먼저 답하고 → 🅱' : '🅱 먼저 답하고 → 🅰'}
          </div>
          <div style={{ fontSize: 17.5, fontWeight: 800, color: level === 3 ? '#0c0c0e' : INK, lineHeight: 1.55, wordBreak: 'keep-all' }}>{card}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '10px 2px 14px', fontSize: 11.5, fontWeight: 700, color: FAINT }}>
        <span>
          Lv{level} · {done}장 답함
          {level === unlocked && level < 3 && done < QUESTIONS_TO_UNLOCK && ` (다음 레벨까지 ${QUESTIONS_TO_UNLOCK - done}장)`}
        </span>
        {passes > 0 && <span>패스 {passes}번 = 🍻 {passes}잔</span>}
      </div>

      {canUnlockNext ? (
        <button
          onClick={() => {
            const next = (level + 1) as 2 | 3;
            setUnlocked(next);
            goLevel(next);
          }}
          style={{ ...bigBtn, background: ACCENT_SOLID, color: '#fff' }}
        >
          🔓 Lv{level + 1} {LEVELS[level].name} 열기 — 더 깊이
        </button>
      ) : lv3Finished ? (
        <button onClick={onEye} style={{ ...bigBtn, background: ACCENT_SOLID, color: '#fff' }}>
          👁 마지막 관문: 1분 눈맞춤 챌린지
        </button>
      ) : (
        <button onClick={() => advance(false)} style={bigBtn}>
          둘 다 답했어요 → 다음 카드
        </button>
      )}
      <button onClick={() => advance(true)} style={{ ...outBtn, marginTop: 8 }}>
        패스… 대신 같이 한 잔 🍻
      </button>
    </Frame>
  );
}

// ═══ 🔮 텔레파시 밸런스 ═══
function Telepathy({ onBack }: { onBack: () => void }) {
  const deckRef = useRef<[string, string][]>(shuffle(BALANCE));
  const [idx, setIdx] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [result, setResult] = useState<'hit' | 'miss' | null>(null);
  const [a, b] = deckRef.current[idx % deckRef.current.length];

  const judge = (hit: boolean) => {
    setResult(hit ? 'hit' : 'miss');
    if (hit) {
      const s = streak + 1;
      setStreak(s);
      if (s > best) setBest(s);
      if (navigator.vibrate) navigator.vibrate(60);
    } else {
      setStreak(0);
    }
  };
  const next = () => {
    setResult(null);
    setIdx((i) => i + 1);
  };

  return (
    <Frame title="🔮 텔레파시 밸런스" onBack={onBack}>
      <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginBottom: 14 }}>
        각자 마음속으로 고르고, <b>"하나 둘 셋!"에 동시에 손가락으로 가리키세요.</b>
        <br />
        통하면 다음으로, 어긋나면 같이 한 잔 🍻
      </p>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 10, minHeight: 130 }}>
        <div style={{ flex: 1, borderRadius: 16, border: `2px solid ${INK}`, background: 'rgba(255,255,255,0.05)', display: 'grid', placeItems: 'center', padding: 16, textAlign: 'center' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: INK, wordBreak: 'keep-all' }}>{a}</span>
        </div>
        <span style={{ alignSelf: 'center', fontSize: 13, fontWeight: 800, color: FAINT }}>vs</span>
        <div style={{ flex: 1, borderRadius: 16, border: `2px solid ${INK}`, background: 'rgba(255,255,255,0.05)', display: 'grid', placeItems: 'center', padding: 16, textAlign: 'center' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: INK, wordBreak: 'keep-all' }}>{b}</span>
        </div>
      </div>

      <div style={{ textAlign: 'center', margin: '12px 0', fontSize: 12.5, fontWeight: 800, color: streak >= 3 ? ACCENT : MUTED }}>
        {result === 'hit' && streak >= 3 ? `🔮 ${streak}연속! 소름 돋게 통하는데요?` : result === 'hit' ? `통했다! ${streak}연속` : result === 'miss' ? '어긋났네요 — 같이 한 잔 🍻' : `현재 ${streak}연속 · 최고 ${best}연속`}
      </div>

      {result === null ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => judge(true)} style={{ ...bigBtn, flex: 1, background: ACCENT_SOLID, color: '#fff' }}>🔮 통했다</button>
          <button onClick={() => judge(false)} style={{ ...bigBtn, flex: 1, background: 'rgba(255,255,255,0.07)', color: INK, border: `1.5px solid ${LINE}` }}>❌ 어긋남</button>
        </div>
      ) : (
        <button onClick={next} style={bigBtn}>다음 질문</button>
      )}
    </Frame>
  );
}

// ═══ 👀 첫인상 퀴즈 ═══
function FirstImpression({ onBack }: { onBack: () => void }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const total = FIRST_IMPRESSION.length;
  const q = FIRST_IMPRESSION[idx];

  const judge = (correct: boolean) => {
    if (correct) setScore((s) => s + 1);
    setPicked(null);
    if (idx + 1 >= total) setFinished(true);
    else setIdx((i) => i + 1);
  };
  const restart = () => {
    setIdx(0);
    setPicked(null);
    setScore(0);
    setFinished(false);
  };

  if (finished) {
    const verdict = score >= 8 ? '소름… 관상가세요? 👁' : score >= 5 ? '꽤 통하는데요? 이제 확인해볼 차례 🍻' : '하나도 몰랐네요 — 이제부터 알아가면 되죠 😎';
    return (
      <Frame title="👀 첫인상 퀴즈" onBack={onBack}>
        <div style={{ borderRadius: 18, border: `2px solid ${ACCENT}`, background: 'rgba(255,255,255,0.05)', padding: '34px 22px', textAlign: 'center' }}>
          <div style={{ fontSize: 38, fontWeight: 800, color: INK }}>
            {score}<span style={{ fontSize: 18, color: FAINT }}> / {total}</span>
          </div>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: ACCENT, marginTop: 10, lineHeight: 1.5 }}>{verdict}</div>
        </div>
        <button onClick={restart} style={{ ...bigBtn, marginTop: 14 }}>역할 바꿔서 한 판 더</button>
      </Frame>
    );
  }

  return (
    <Frame title="👀 첫인상 퀴즈" onBack={onBack}>
      <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginBottom: 14 }}>
        한 사람이 폰을 들고 <b>상대를 첫인상만으로 맞혀보세요.</b> 고르면 상대가 정답 판정!
      </p>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: FAINT, marginBottom: 8 }}>
        {idx + 1} / {total} · 현재 {score}개 적중
      </div>
      <div style={{ borderRadius: 16, border: `2px solid ${INK}`, background: 'rgba(255,255,255,0.05)', padding: '20px 18px', marginBottom: 12 }}>
        <div style={{ fontSize: 16.5, fontWeight: 800, color: INK, wordBreak: 'keep-all' }}>{q.q}</div>
      </div>
      {picked === null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {q.options.map((o) => (
            <button key={o} onClick={() => setPicked(o)} style={outBtn}>
              {o}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div style={{ textAlign: 'center', fontSize: 13.5, fontWeight: 800, color: INK, margin: '4px 0 12px' }}>
            선택: <span style={{ color: ACCENT }}>{picked}</span> — 맞았나요?
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => judge(true)} style={{ ...bigBtn, flex: 1, background: ACCENT_SOLID, color: '#fff' }}>⭕ 맞았어요</button>
            <button onClick={() => judge(false)} style={{ ...bigBtn, flex: 1, background: 'rgba(255,255,255,0.07)', color: INK, border: `1.5px solid ${LINE}` }}>❌ 틀렸어요</button>
          </div>
        </>
      )}
    </Frame>
  );
}

// ═══ 🙅 한번도 게임 ═══
function NeverEver({ onBack }: { onBack: () => void }) {
  const deckRef = useRef<string[]>(shuffle(NEVER_EVER));
  const [idx, setIdx] = useState(0);
  const card = deckRef.current[idx % deckRef.current.length];

  return (
    <Frame title="🙅 한번도 게임" onBack={onBack}>
      <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginBottom: 14 }}>
        다 같이 손가락 5개를 펴고 시작 — <b>해당되는 사람은 손가락을 접고 마십니다.</b>
        <br />
        먼저 다 접는 사람이 오늘의 경험왕 👑
      </p>
      <div style={{ minHeight: 150, borderRadius: 18, border: `2px solid ${ACCENT}`, background: 'rgba(255,255,255,0.05)', display: 'grid', placeItems: 'center', padding: '26px 22px', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT, marginBottom: 8 }}>나는 한 번도…</div>
          <div style={{ fontSize: 17.5, fontWeight: 800, color: INK, lineHeight: 1.5, wordBreak: 'keep-all' }}>{card}</div>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: FAINT, margin: '10px 0 12px' }}>
        {(idx % deckRef.current.length) + 1} / {deckRef.current.length}
      </div>
      <button onClick={() => setIdx((i) => i + 1)} style={bigBtn}>다음 카드</button>
    </Frame>
  );
}

// ═══ 👁 눈맞춤 챌린지 ═══
function EyeContact({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<'idle' | 'run' | 'done'>('idle');
  const [left, setLeft] = useState(60);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    setState('run');
    setLeft(60);
    timer.current = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) {
          if (timer.current) clearInterval(timer.current);
          setState('done');
          if (navigator.vibrate) navigator.vibrate([120, 60, 200]);
          return 0;
        }
        return l - 1;
      });
    }, 1000);
  };
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  return (
    <Frame title="👁 눈맞춤 챌린지" onBack={onBack}>
      <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginBottom: 14 }}>
        아서 아론의 그 실험 — 낯선 사이도 가까워진다는 마지막 관문.
        <br />
        <b>말하기 금지 · 웃으면 패배 · 눈 돌려도 패배.</b> 진 사람이 한 잔 🍻
      </p>
      {state === 'idle' && (
        <button onClick={start} style={{ ...bigBtn, height: 120, fontSize: 18 }}>
          👁 1분 시작 — 폰을 사이에 두고
        </button>
      )}
      {state === 'run' && (
        <div style={{ height: 200, borderRadius: 18, background: '#fff', display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 54, fontWeight: 800, color: '#0c0c0e', fontVariantNumeric: 'tabular-nums' }}>{left}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT_SOLID, marginTop: 4 }}>서로의 눈만 보세요 · 웃으면 집니다</div>
          </div>
        </div>
      )}
      {state === 'done' && (
        <>
          <div style={{ height: 170, borderRadius: 18, background: 'rgba(139,92,246,0.16)', border: `2px solid ${ACCENT}`, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 20 }}>
            <div>
              <div style={{ fontSize: 40 }}>🎉</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: INK, marginTop: 6 }}>1분 성공! 이제 남남은 아니네요</div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: MUTED, marginTop: 4 }}>건배로 마무리 🥂 (중간에 웃은 사람은 한 잔)</div>
            </div>
          </div>
          <button onClick={() => setState('idle')} style={{ ...outBtn, marginTop: 12 }}>한 번 더</button>
        </>
      )}
    </Frame>
  );
}

// ═══ 이름 입력 공용 ═══
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
          style={{ flex: 1, height: 46, padding: '0 14px', borderRadius: 11, border: `1px solid ${LINE}`, fontSize: 14, outline: 'none', color: INK, background: 'rgba(255,255,255,0.06)' }}
        />
        <button onClick={add} style={{ width: 64, borderRadius: 11, background: '#fff', color: '#0c0c0e', fontSize: 13.5, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
          추가
        </button>
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
        {names.map((n) => (
          <button key={n} onClick={() => setNames(names.filter((x) => x !== n))} style={{ padding: '7px 12px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', border: 'none', fontSize: 13, fontWeight: 700, color: INK, cursor: 'pointer' }}>
            {n} ×
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══ 🎯 벌칙 룰렛 ═══
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
      <div style={{ margin: '22px 0', height: 110, borderRadius: 16, border: `2px solid ${winner ? ACCENT : LINE}`, background: 'rgba(255,255,255,0.05)', display: 'grid', placeItems: 'center' }}>
        <span style={{ fontSize: winner ? 30 : 24, fontWeight: 800, color: winner ? ACCENT : INK }}>
          {winner ? `${winner} 당첨!` : current || '?'}
        </span>
      </div>
      <button onClick={spin} disabled={names.length < 2 || spinning} style={{ ...bigBtn, background: names.length < 2 ? 'rgba(255,255,255,0.12)' : '#fff' }}>
        {spinning ? '돌아가는 중…' : '돌리기!'}
      </button>
      {winner && <PenaltyCta name={winner} onGoMenu={onGoMenu} />}
    </Frame>
  );
}

// ═══ 💣 폭탄 타이머 ═══
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
        <button onClick={start} style={{ ...bigBtn, height: 120, fontSize: 20 }}>
          💣 시작 — 폰 돌리기!
        </button>
      )}
      {state === 'ticking' && (
        <div style={{ height: 180, borderRadius: 18, background: 'rgba(251,146,60,0.14)', border: '2px solid rgba(251,146,60,0.5)', display: 'grid', placeItems: 'center' }}>
          <span className="animate-pulse" style={{ fontSize: 44 }}>💣</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#fdba74' }}>돌려! 돌려! 돌려!</span>
        </div>
      )}
      {state === 'boom' && (
        <>
          <div style={{ height: 180, borderRadius: 18, background: 'rgba(239,68,68,0.14)', border: '2px solid rgba(239,68,68,0.6)', display: 'grid', placeItems: 'center' }}>
            <span style={{ fontSize: 52 }}>💥</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#f87171' }}>펑! 들고 있는 사람 당첨!</span>
          </div>
          <button onClick={() => setState('idle')} style={{ ...outBtn, marginTop: 14 }}>
            다시 하기
          </button>
          <PenaltyCta name="당첨자" onGoMenu={onGoMenu} />
        </>
      )}
    </Frame>
  );
}

// ═══ 🪜 사다리타기 ═══
function Ladder({ onBack, onGoMenu }: { onBack: () => void; onGoMenu: () => void }) {
  const [names, setNames] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<string | null>(null);
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const winnerRef = useRef('');

  const shuffleLadder = () => {
    if (names.length < 2) return;
    winnerRef.current = names[Math.floor(Math.random() * names.length)];
    setOpened(new Set());
    setRevealed('ready');
  };

  return (
    <Frame title="🪜 사다리타기" onBack={onBack}>
      <NameChips names={names} setNames={setNames} />
      {revealed !== 'ready' ? (
        <button onClick={shuffleLadder} disabled={names.length < 2} style={{ ...bigBtn, marginTop: 20, background: names.length < 2 ? 'rgba(255,255,255,0.12)' : '#fff' }}>
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
                  style={{ height: 64, borderRadius: 12, fontSize: 14.5, fontWeight: 800, border: '1.5px solid', borderColor: open ? (isWinner ? ACCENT : LINE) : INK, background: open ? (isWinner ? ACCENT_SOLID : 'rgba(255,255,255,0.05)') : 'rgba(255,255,255,0.07)', color: open ? (isWinner ? '#fff' : FAINT) : INK, cursor: 'pointer' }}
                >
                  {open ? (isWinner ? `${n} 🍺 당첨!` : `${n} · 통과`) : n}
                </button>
              );
            })}
          </div>
          <button onClick={shuffleLadder} style={{ ...outBtn, marginTop: 12 }}>
            다시 섞기
          </button>
          {[...opened].includes(winnerRef.current) && <PenaltyCta name={winnerRef.current} onGoMenu={onGoMenu} />}
        </>
      )}
    </Frame>
  );
}

// ═══ 📖 도감 ═══
function Rules({ onBack }: { onBack: () => void }) {
  return (
    <Frame title="📖 술게임 도감" onBack={onBack}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {RULES.map((r) => (
          <div key={r.title} style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${LINE}`, borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 14.5, fontWeight: 800, color: INK }}>{r.title}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: FAINT }}>{r.people}</span>
              {r.tags.map((t) => (
                <span key={t} style={{ fontSize: 10.5, fontWeight: 800, color: ACCENT, background: 'rgba(139,92,246,0.16)', borderRadius: 6, padding: '2px 7px' }}>
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

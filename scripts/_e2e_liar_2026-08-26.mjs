// 라이어 게임 E2E — 3인 풀플로우 (마이그레이션 실행 후 사용).
// node scripts/_e2e_liar_2026-08-26.mjs [baseUrl]  (기본: 프로덕션)
const BASE = process.argv[2] || 'https://honsulmap.com';
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`PASS ${name} ${extra}`); }
  else { fail++; console.log(`FAIL ${name} ${extra}`); }
};
const post = async (payload) => {
  const r = await fetch(`${BASE}/api/game/liar`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};
const get = async (code, pid) => {
  const r = await fetch(`${BASE}/api/game/liar?code=${code}&pid=${pid}`);
  return { status: r.status, data: await r.json().catch(() => ({})) };
};

// 1. 방 생성
let r = await post({ action: 'create', nick: 'host' });
ok('create', r.status === 201 && r.data.code?.length === 4, `code=${r.data.code}`);
const code = r.data.code, host = r.data.player_id;

// 2. 2명 입장 + 중복 닉 거부
r = await post({ action: 'join', code, nick: 'p2' });
ok('join-p2', r.status === 201);
const p2 = r.data.player_id;
r = await post({ action: 'join', code, nick: 'p2' });
ok('dup-nick-409', r.status === 409);
r = await post({ action: 'join', code, nick: 'p3' });
const p3 = r.data.player_id;
ok('join-p3', r.status === 201);

// 3. 비방장 시작 거부 → 방장 시작
r = await post({ action: 'start', code, pid: p2 });
ok('start-nonhost-403', r.status === 403);
r = await post({ action: 'start', code, pid: host });
ok('start', r.status === 200);

// 4. 역할 분배 검증: 라이어 1명, 시민은 단어 보임/라이어는 안 보임
const views = await Promise.all([get(code, host), get(code, p2), get(code, p3)]);
const liars = views.filter((v) => v.data.me?.is_liar);
ok('one-liar', liars.length === 1);
const citizen = views.find((v) => !v.data.me?.is_liar);
const liarView = liars[0];
ok('citizen-sees-word', typeof citizen?.data.room.word === 'string' && citizen.data.room.word.length > 0);
ok('liar-hidden-word', liarView?.data.room.word === null, `category=${liarView?.data.room.category}`);

// 5. 시작된 방 입장 차단
r = await post({ action: 'join', code, nick: 'late' });
ok('late-join-409', r.status === 409);

// 6. 투표 열기 → 전원이 라이어 지목 → liar_guess 페이즈
r = await post({ action: 'open_vote', code, pid: host });
ok('open-vote', r.status === 200);
const liarPid = liarView.data.me.id;
const others = [host, p2, p3].filter((id) => id !== liarPid);
await post({ action: 'vote', code, pid: others[0], target: liarPid });
await post({ action: 'vote', code, pid: others[1], target: liarPid });
r = await post({ action: 'vote', code, pid: liarPid, target: others[0] });
ok('votes-in', r.status === 200);
let s = await get(code, host);
ok('phase-liar-guess', s.data.room.phase === 'liar_guess', `accused ok=${s.data.room.accused === liarPid}`);

// 7. 라이어 오답 → 시민 승리 + 전원 단어 공개
r = await post({ action: 'guess', code, pid: liarPid, text: '절대아닌답123' });
ok('guess-wrong', r.status === 200 && r.data.correct === false);
s = await get(code, liarPid);
ok('citizens-win', s.data.room.phase === 'done' && s.data.room.winner === 'citizens');
ok('word-revealed-to-liar', typeof s.data.room.word === 'string');

// 8. 한 판 더 → 새 라운드
r = await post({ action: 'again', code, pid: host });
ok('again', r.status === 200);
s = await get(code, host);
ok('round-2', s.data.room.phase === 'discuss' && s.data.room.round === 2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

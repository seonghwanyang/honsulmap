// 테이블 서비스 E2E — dev 서버(localhost:3000) 상대로 손님 플로우 전체.
const BASE = 'http://localhost:3000';
const HIGHBALL = process.argv[2]; // 하이볼 item id
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`PASS ${name} ${extra}`); }
  else { fail++; console.log(`FAIL ${name} ${extra}`); }
};

// 1. 손님 페이지 렌더
const page = await fetch(`${BASE}/t/janzan-jeju`);
const html = await page.text();
ok('page-200', page.status === 200);
ok('page-has-client', html.includes('Seat') || html.includes('TableClient') || html.includes('체크인'));

// 2. 체크인
let r = await fetch(`${BASE}/api/t/janzan-jeju/checkin`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ seat_label: '3', phone4: '1234', gender: 'm', age_band: '30대 초반', tmi: 'e2e test' }),
});
let d = await r.json();
ok('checkin-201', r.status === 201, `seat=${d.session?.seat_label}`);
const sid = d.session?.id;

// 3. 세션 복구 (같은 폰번호)
r = await fetch(`${BASE}/api/t/janzan-jeju/checkin`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ seat_label: '3', phone4: '1234', gender: 'm' }),
});
d = await r.json();
ok('rejoin-200', r.status === 200 && d.session?.id === sid);

// 4. 좌석 충돌 (다른 폰번호)
r = await fetch(`${BASE}/api/t/janzan-jeju/checkin`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ seat_label: '3', phone4: '9999', gender: 'f' }),
});
ok('conflict-409', r.status === 409);

// 5. 상태 폴링 — 좌석 점유 보임
r = await fetch(`${BASE}/api/t/janzan-jeju/state`);
d = await r.json();
ok('state-session', r.status === 200 && d.sessions?.length === 1 && d.live_status === 'busy');

// 6. 주문 (서버 가격 계산 검증: 하이볼 8000 x 2 = 16000)
r = await fetch(`${BASE}/api/t/janzan-jeju/orders`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ session_id: sid, items: [{ id: HIGHBALL, qty: 2, request: 'less ice' }] }),
});
d = await r.json();
ok('order-201', r.status === 201 && d.total === 16000, `total=${d.total}`);

// 7. 내 주문 조회
r = await fetch(`${BASE}/api/t/janzan-jeju/orders?sid=${sid}`);
d = await r.json();
ok('myorders', r.status === 200 && d.seat_total === 16000 && d.orders?.[0]?.items?.[0]?.qty === 2);

// 8. 잘못된 아이템 방어
r = await fetch(`${BASE}/api/t/janzan-jeju/orders`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ session_id: sid, items: [{ id: '00000000-0000-0000-0000-000000000000', qty: 1 }] }),
});
ok('bad-item-400', r.status === 400);

// 9. 세션 없이 주문 차단
r = await fetch(`${BASE}/api/t/janzan-jeju/orders`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ items: [{ id: HIGHBALL, qty: 1 }] }),
});
ok('no-session-401', r.status === 401);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

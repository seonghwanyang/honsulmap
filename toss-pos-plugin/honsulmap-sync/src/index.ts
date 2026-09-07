/**
 * 혼술맵 테이블 싱크 — 토스 POS 워커 플러그인.
 *
 * QR 주문을 혼술맵 서버 피드에서 5초마다 끌어와, 포스 카탈로그와 이름+가격으로
 * 매칭한 뒤 좌석 번호와 이름이 일치하는 테이블에 주문을 직접 생성한다
 * (order.add + tableId). 매칭 실패는 서버에 ack(unmatched)로 알려 Open API
 * 폴백(현황 탭행)이 처리하게 한다 — 어떤 경우에도 주문은 포스에 정확히 한 번.
 *
 * 일부 SDK 응답 필드(카탈로그 가격 구조, chargePrice 의미)는 문서에 미기재라
 * 방어적으로 읽고 로그를 남긴다 — 첫 실기기(개발 배포) 테스트에서 검증한다.
 */
import { posPluginSdk } from "@tossplace/pos-plugin-sdk";

const FEED_URL = "https://honsulmap.com/api/tossplugin/feed";
const PLUGIN_KEY = "HSMPK-b3fe4a8c9f42148098bcf6497cd5c83639061d232e774064";
const POLL_MS = 5000;
const REFRESH_MS = 10 * 60 * 1000;

type FeedItem = { name: string; price: number; qty: number; request?: string | null };
type FeedOrder = { id: string; seat_label: string; total: number; items: FeedItem[] };
// 자리이동 지시 — pos_order_ids(옮길 포스 주문들)를 to_seat 테이블로 재생성+원본 취소
type FeedMove = { id: string; to_seat: string; pos_order_ids: string[] };

/* eslint-disable @typescript-eslint/no-explicit-any */
const sdk = posPluginSdk as any;

let merchantId: number | null = null;
let tables: any[] = [];
let catalogIndex = new Map<string, any>();
let catalogList: any[] = [];
const inflight = new Set<string>();
// 검수용 데모 — 혼술맵 미연동 매장(검수 환경)에서 동작을 보여주기 위해
// 그 포스의 카탈로그 첫 상품 + 첫 테이블로 주문을 1회만 생성한다.
let demoAttempts = 0;
let demoDone = false;
// 주문별 반영 재시도 횟수 — 결제 진행 중엔 테이블 주문이 잠겨 add/addMenu가 거부되는데,
// 결제는 보통 1분 내 끝나므로 ack 없이 두면 다음 폴링(5초)마다 자연 재시도된다.
// 12회(약 60초) 소진 시에만 폴백(ack error → Open API 현황행). 90초 스윕보다 먼저 끝나게.
// at = 마지막 시도 시각 — 서버가 피드에서 내린(취소 등) 주문 항목의 누수 청소용 (검수 권고 2)
const addAttempts = new Map<string, { n: number; at: number }>();

const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

// ── 테이블 "열린 주문 1개" 대응 (v3.1) ──
// 토스 테이블은 열린 주문이 이미 있으면 order.add(tableId)를 거부한다 (실측:
// 연속 주문 시 첫 건만 added, 나머지 error→폴백). 두 번째부터는 addMenu로
// 기존 주문에 메뉴를 추가한다 — 직원이 그 테이블에 추가 입력하는 것과 동일.
const tableOrders = new Map<number, string>(); // tableId → 열린 포스 주문 id (캐시)

// 영업일 시작(아침 8시 KST) — 열린 테이블 주문 검색 범위
function businessDayStartIso(): string {
  const kst = new Date(Date.now() + 9 * 3600_000);
  const s = new Date(kst);
  if (kst.getUTCHours() < 8) s.setUTCDate(s.getUTCDate() - 1);
  s.setUTCHours(8, 0, 0, 0);
  return new Date(s.getTime() - 9 * 3600_000).toISOString();
}

async function fetchOpenOrders(): Promise<any[]> {
  try {
    return (
      (await sdk.order.getOrders({
        start: businessDayStartIso(),
        end: new Date(Date.now() + 60_000).toISOString(),
        orderStates: ["OPENED"],
        size: 100,
      })) ?? []
    );
  } catch (e) {
    remoteLog("warn", "열린 주문 조회 실패", e);
    return [];
  }
}

// 검수 권고(우선) 반영: 타임아웃/응답 유실 시 재시도가 같은 메뉴를 두 번 넣지 않게,
// 실패하면 "실제로 반영됐는지"를 먼저 확인하고 성공 처리한다.
//  - addMenu 실패 → 대상 주문의 라인 수가 (호출 전 + 추가분) 이상이면 반영된 것
//  - add 실패     → 열린 주문 중 같은 orderKey가 있으면 생성된 것
async function createOrAppend(dto: any, tableId: number | undefined): Promise<string | undefined> {
  if (tableId) {
    const open = await fetchOpenOrders();
    const knownId = tableOrders.get(tableId);
    // 직원이 연 테이블 주문도 대상 — 그 테이블 계산서에 합치는 게 맞는 동작
    const target =
      (knownId && open.find((o: any) => o?.id === knownId)) ||
      open.find((o: any) => o?.tableId === tableId || o?.table?.id === tableId);
    if (target) {
      const before = target.lineItems?.length ?? 0;
      try {
        await sdk.order.addMenu(target.id, dto);
        tableOrders.set(tableId, target.id);
        return target.id;
      } catch (e) {
        const after = (await fetchOpenOrders()).find((o: any) => o?.id === target.id);
        if (after && (after.lineItems?.length ?? 0) >= before + dto.lineItems.length) {
          remoteLog("warn", `addMenu 응답 유실 — 반영 확인돼 성공 처리 t${tableId}`);
          tableOrders.set(tableId, target.id);
          return target.id;
        }
        remoteLog("warn", `addMenu 실패 → 새 주문 생성 시도 t${tableId}`, e);
        tableOrders.delete(tableId); // 닫힌 주문이었을 수 있음 — 캐시 무효화
      }
    }
  }
  try {
    const created = await sdk.order.add(dto);
    if (tableId && created?.id) tableOrders.set(tableId, created.id);
    return created?.id;
  } catch (e) {
    const dup = (await fetchOpenOrders()).find((o: any) => o?.orderKey === dto.orderKey);
    if (dup) {
      remoteLog("warn", `order.add 응답 유실 — orderKey로 확인돼 성공 처리 ${dto.orderKey}`);
      if (tableId && dup.id) tableOrders.set(tableId, dup.id);
      return dup.id;
    }
    throw e; // 진짜 실패(결제 중 잠금 등) → handle()의 재시도/폴백 경로
  }
}

// 원격 로그 (토스 검수 권고) — 실패 지점을 혼술맵 서버로 전송. 분당 20건 스로틀.
let logCount = 0;
let logWindow = 0;
function remoteLog(level: "error" | "warn" | "info", msg: string, detail?: unknown) {
  console.log(`[hsm][${level}]`, msg, detail ?? "");
  const now = Date.now();
  if (now - logWindow > 60_000) {
    logWindow = now;
    logCount = 0;
  }
  if (logCount >= 20) return;
  logCount++;
  try {
    void sdk.http.post(
      FEED_URL,
      {
        mid: String(merchantId ?? "?"),
        log: { level, msg, detail: detail instanceof Error ? detail.message : String(detail ?? "") },
      },
      [
        ["Content-Type", "application/json"],
        ["x-hsm-plugin-key", PLUGIN_KEY],
      ],
    );
  } catch {
    /* 로그 전송 실패는 무시 */
  }
}

function catalogPrice(c: any): number {
  return Number(c?.price?.value ?? c?.price?.priceValue ?? c?.price ?? NaN);
}

async function refreshTables() {
  try {
    tables = (await sdk.table.getTables()) ?? [];
    console.log("[hsm] 테이블", tables.length, "개 로드");
  } catch (e) {
    remoteLog("error", "테이블 로드 실패", e);
    tables = [];
  }
}

async function refreshCatalog() {
  try {
    const cats = (await sdk.catalog.getCatalogs()) ?? [];
    catalogList = cats;
    catalogIndex = new Map();
    const titleCount = new Map<string, number>();
    for (const c of cats) {
      const t = String(c?.title ?? "").trim();
      if (t) titleCount.set(t, (titleCount.get(t) ?? 0) + 1);
    }
    for (const c of cats) {
      const title = String(c?.title ?? "").trim();
      if (!title) continue;
      catalogIndex.set(`${title}|${catalogPrice(c)}`, c);
      // 이름 단독 폴백은 동명 상품이 1개일 때만 — 동명 다수면 오매칭 위험이라
      // unmatched → 현황행 폴백이 안전 (검수 권고 5)
      if (titleCount.get(title) === 1) catalogIndex.set(title, c);
    }
    console.log("[hsm] 카탈로그", cats.length, "개 인덱싱");
  } catch (e) {
    remoteLog("error", "카탈로그 로드 실패", e);
  }
}

// "좌석 N" ↔ 포스 테이블 이름 매칭 — 숫자만 뽑아 비교 ("테이블 3" == 좌석 "3")
function matchTableId(seatLabel: string): number | undefined {
  const want = digits(seatLabel);
  if (!want) return undefined;
  // "01" vs "1" 0패딩 차이 흡수 — 숫자값으로 비교 (실측: 단자리 좌석이 미매칭돼 전표만 출력)
  const hit = tables.find((t) => {
    const d = digits(t?.title);
    return d !== "" && Number(d) === Number(want);
  });
  return hit?.id;
}

function toLineItem(fi: FeedItem) {
  const c = catalogIndex.get(`${fi.name}|${fi.price}`) ?? catalogIndex.get(fi.name);
  if (!c) throw new Error(`카탈로그 미매칭: ${fi.name}`);
  const req = (fi.request ?? "").trim();
  return {
    diningOption: "HERE",
    item: { id: c.id, title: c.title, category: c.category, type: "ITEM" },
    quantity: { value: fi.qty },
    chargePrice: { value: fi.price * fi.qty }, // 라인 청구액으로 가정 — 실기기에서 금액 검증
    optionChoices: [],
    ...(req ? { memo: req } : {}),
  };
}

async function ack(orderId: string, outcome: "added" | "unmatched" | "error" | "moved", tossOrderId?: unknown) {
  try {
    await sdk.http.post(
      FEED_URL,
      { mid: String(merchantId), order_id: orderId, outcome, toss_order_id: tossOrderId ?? null },
      [
        ["Content-Type", "application/json"],
        ["x-hsm-plugin-key", PLUGIN_KEY],
      ],
    );
  } catch (e) {
    remoteLog("error", `ack 전송 실패 ${orderId}`, e);
  }
}

async function handle(order: FeedOrder) {
  if (inflight.has(order.id)) return;
  inflight.add(order.id);
  try {
    let lineItems: ReturnType<typeof toLineItem>[];
    try {
      lineItems = order.items.map(toLineItem);
    } catch (e) {
      remoteLog("warn", `카탈로그 미매칭 → 폴백 ${order.id}`, e);
      await ack(order.id, "unmatched");
      return;
    }
    const tableId = matchTableId(order.seat_label);
    // 미매칭이면 테이블 없는 주문(전표만)이 되므로 실제 포스 테이블명을 남겨 원인 즉시 확인
    if (!tableId)
      remoteLog("warn", `테이블 매칭 실패 — 좌석 ${order.seat_label} / 포스 테이블: ${tables.map((t) => t?.title).join(",") || "(없음)"}`);
    const dto = {
      orderKey: order.id,
      memo: `혼술맵 QR · 좌석 ${order.seat_label}`,
      discounts: [],
      lineItems,
      ...(tableId ? { tableId } : {}),
    };
    const posId = await createOrAppend(dto, tableId);
    addAttempts.delete(order.id);
    console.log("[hsm] 주문 반영 OK", order.id, "→ table", tableId ?? "(미지정)", "posOrder", posId);
    await ack(order.id, "added", posId);
  } catch (e) {
    const n = (addAttempts.get(order.id)?.n ?? 0) + 1;
    addAttempts.set(order.id, { n, at: Date.now() });
    if (n < 12) {
      // 결제 중 잠금 등 일시 실패 가능성 — ack 없이 반환하면 다음 폴링에 재시도
      if (n === 1) remoteLog("warn", `주문 반영 일시 실패 — 재시도 시작 ${order.id}`, e);
      return;
    }
    addAttempts.delete(order.id);
    remoteLog("error", `주문 반영 실패(재시도 소진) → 폴백 ${order.id}`, e);
    await ack(order.id, "error");
  } finally {
    inflight.delete(order.id);
  }
}

// ── 자리이동 (v5.2) ── 손님이 QR 재스캔으로 자리를 옮기면 서버가 이동 지시를 내린다.
// 옛 테이블의 우리 주문(들)을 읽어 새 테이블에 재생성(열린 주문 있으면 합류)하고 원 주문을
// 취소한다 — 직원이 포스에서 테이블 이동하는 것과 같은 결과. 결제 중 잠금 등 일시 실패는
// ack 없이 두면 폴링·결제완료 이벤트로 자연 재시도. 반환값 = 이번 틱에 주문 투입을 보류할
// 테이블들(이동 미완료 시 섞임 방지), 완료·포기 시 빈 배열.
async function handleMove(mv: FeedMove): Promise<number[]> {
  if (inflight.has(mv.id)) return [];
  inflight.add(mv.id);
  let blockedT: number[] = [];
  try {
    const toTableId = matchTableId(mv.to_seat);
    if (!toTableId) {
      remoteLog("warn", `자리이동 실패 — 좌석 ${mv.to_seat} 테이블 미매칭`);
      await ack(mv.id, "error");
      return [];
    }
    blockedT = [toTableId];
    const open = await fetchOpenOrders();
    const srcs = open.filter(
      (o: any) => mv.pos_order_ids.includes(String(o?.id)) && (o?.tableId ?? o?.table?.id) !== toTableId,
    );
    if (!srcs.length) {
      await ack(mv.id, "moved"); // 옮길 게 없음(이미 결제·취소·이동됨) — 완료 처리
      return [];
    }
    blockedT = [toTableId, ...srcs.map((s: any) => s.tableId ?? s.table?.id).filter(Boolean)];
    const srcIds = new Set(mv.pos_order_ids);
    let target: any = open.find(
      (o: any) => (o?.tableId === toTableId || o?.table?.id === toTableId) && !srcIds.has(String(o?.id)),
    );
    for (const src of srcs) {
      const mvKey = `${src.orderKey}-mv`;
      const lines = (src.lineItems ?? []).map((li: any) => ({
        diningOption: li?.diningOption ?? "HERE",
        item: { id: li?.item?.id, title: li?.item?.title, category: li?.item?.category, type: li?.item?.type ?? "ITEM" },
        quantity: { value: li?.quantity?.value ?? 1 },
        chargePrice: { value: li?.chargePrice?.value ?? 0 },
        optionChoices: li?.optionChoices ?? [],
        ...(li?.memo ? { memo: li.memo } : {}),
      }));
      // 재시도 중복 방지 — 이 원 주문의 재생성분이 이미 있으면 그걸 대상으로 삼고 재추가 생략
      const dup = open.find((o: any) => o?.orderKey === mvKey);
      if (dup) target = dup;
      else if (target) {
        const before = target.lineItems?.length ?? 0;
        try {
          await sdk.order.addMenu(target.id, { discounts: [], lineItems: lines });
        } catch (e) {
          const after = (await fetchOpenOrders()).find((o: any) => o?.id === target.id);
          if (!after || (after.lineItems?.length ?? 0) < before + lines.length) throw e;
          remoteLog("warn", `이동 addMenu 응답 유실 — 반영 확인돼 진행 t${toTableId}`);
        }
      } else {
        target = await sdk.order.add({
          orderKey: mvKey,
          memo: src.memo ?? `혼술맵 QR · 좌석 ${mv.to_seat} (자리이동)`,
          discounts: [],
          lineItems: lines,
          tableId: toTableId,
        });
      }
      try {
        await sdk.order.cancel(src.id);
      } catch (e) {
        // 취소만 실패(원 테이블 결제 시작 등) — 메뉴는 이미 새 테이블에 반영됨.
        // 재시도하면 중복되므로 완료 처리하고 수동 취소를 로그로 요청.
        remoteLog("error", `이동 후 원 주문 취소 실패 — 포스에서 수동 취소 필요 (${src.orderKey})`, e);
      }
      const st = src.tableId ?? src.table?.id;
      if (st) tableOrders.delete(st);
    }
    if (target?.id) tableOrders.set(toTableId, String(target.id));
    addAttempts.delete(mv.id);
    remoteLog("info", `자리이동 완료 → 좌석 ${mv.to_seat} (포스 주문 ${srcs.length}건 합류)`);
    await ack(mv.id, "moved", target?.id);
    return [];
  } catch (e) {
    const n = (addAttempts.get(mv.id)?.n ?? 0) + 1;
    addAttempts.set(mv.id, { n, at: Date.now() });
    if (n < 12) {
      if (n === 1) remoteLog("warn", `자리이동 일시 실패 — 재시도 시작 (좌석 ${mv.to_seat})`, e);
      return blockedT; // 미완료 — 관련 테이블 주문 투입 보류
    }
    addAttempts.delete(mv.id);
    remoteLog("error", `자리이동 실패(재시도 소진) — 직원 수동 이동 필요 (좌석 ${mv.to_seat})`, e);
    await ack(mv.id, "error");
    return [];
  } finally {
    inflight.delete(mv.id);
  }
}

// 검수용 데모 주문 — 이 포스의 첫 상품·첫 테이블로 1회 생성 (외부 데이터 불필요)
async function runDemoOnce() {
  if (demoDone || demoAttempts >= 3) return;
  demoAttempts++;
  try {
    if (!catalogList.length) await refreshCatalog();
    if (!tables.length) await refreshTables();
    const c = catalogList[0];
    if (!c) {
      console.log("[hsm][demo] 카탈로그가 비어 있어 데모를 건너뜁니다");
      return;
    }
    const price = catalogPrice(c);
    const table = tables[0];
    const dto = {
      orderKey: `hsm-demo-${Date.now()}`,
      memo: "혼술맵 테이블 싱크 · 검수용 데모 주문입니다 — 취소하셔도 됩니다",
      discounts: [],
      lineItems: [
        {
          diningOption: "HERE",
          item: { id: c.id, title: c.title, category: c.category, type: "ITEM" },
          quantity: { value: 1 },
          chargePrice: { value: Number.isFinite(price) ? price : 0 },
          optionChoices: [],
        },
      ],
      ...(table?.id ? { tableId: table.id } : {}),
    };
    const created = await sdk.order.add(dto);
    demoDone = true;
    console.log("[hsm][demo] 데모 주문 생성 OK → table", table?.id ?? "(미지정)", "order", created?.id);
  } catch (e) {
    remoteLog("error", `데모 주문 실패 ${demoAttempts}회차`, e);
  }
}

async function tick() {
  if (!merchantId) return;
  // 재시도 캐시 청소 — 피드에서 사라진 주문(취소 등)의 항목이 장기 상주 워커에 누적되지 않게
  const cutoff = Date.now() - 10 * 60_000;
  for (const [k, v] of addAttempts) if (v.at < cutoff) addAttempts.delete(k);
  try {
    const res = await sdk.http.get(`${FEED_URL}?mid=${merchantId}`, [["x-hsm-plugin-key", PLUGIN_KEY]]);
    if (res?.code !== 200) { remoteLog("warn", `피드 응답 이상 ${res?.code}`); return; }
    const parsed = JSON.parse(res.body ?? "{}");
    if (parsed.demo) {
      await runDemoOnce();
      return;
    }
    // 자리이동 먼저 — 이동이 끝나지 않은 테이블로는 이번 틱에 주문을 넣지 않는다
    // (이전 손님 계산서에 새 주문이 섞이는 것 방지). 다음 틱(5초)에 자연 재개.
    const blocked = new Set<number>();
    for (const mv of (parsed.moves ?? []) as FeedMove[]) {
      for (const t of await handleMove(mv)) blocked.add(t);
    }
    for (const o of parsed.orders ?? []) {
      if (blocked.size) {
        const tid = matchTableId(o.seat_label);
        if (tid && blocked.has(tid)) continue;
      }
      await handle(o);
    }
  } catch (e) {
    remoteLog("error", "피드 조회 실패", e);
  }
}

async function main() {
  const merchant = await sdk.merchant.getMerchant();
  merchantId = Number(merchant?.id ?? merchant?.merchantId);
  console.log("[hsm] 혼술맵 테이블 싱크 시작 — merchant", merchantId);
  // 버전을 로그에 남겨야 포스가 실제 어떤 버전을 로드했는지 서버에서 구분 가능
  remoteLog("info", `플러그인 시작 v5.2 — merchant ${merchantId}`);
  await refreshTables();
  await refreshCatalog();
  // 테이블 변경(추가/이동/합석 등) 시 갱신 — on 미지원 환경 대비 try
  try {
    for (const ev of ["add", "update", "delete", "move", "merge", "clear"]) {
      sdk.table.on?.(ev, refreshTables);
    }
  } catch {
    /* 이벤트 미지원이면 주기 갱신만 */
  }
  // 주문 완료 이벤트 = 결제 잠금 해제 신호.
  // ① 테이블→주문 캐시 정리(새 손님은 새 주문으로) ② 대기 중(재시도) 주문을 즉시
  // 재처리 — 5초 폴링을 기다리지 않고 결제 끝나자마자 테이블 합류. 이벤트 미지원
  // 포스에선 기존 5초 폴링이 그대로 안전망 (inflight 가드로 이중 처리 없음).
  try {
    sdk.order.on?.("complete", (id: string) => {
      for (const [t, oid] of tableOrders) if (oid === id) tableOrders.delete(t);
      setTimeout(() => void tick(), 400); // 포스 내부 상태 정리 직후 피드 재처리
    });
  } catch {
    /* 미지원 무시 */
  }
  setInterval(refreshTables, REFRESH_MS);
  setInterval(refreshCatalog, REFRESH_MS);
  setInterval(tick, POLL_MS);
  void tick();
}

void main();

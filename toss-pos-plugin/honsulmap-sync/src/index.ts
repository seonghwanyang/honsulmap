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
const addAttempts = new Map<string, number>();

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

async function findOpenPosOrder(tableId: number): Promise<string | undefined> {
  try {
    const list =
      (await sdk.order.getOrders({
        start: businessDayStartIso(),
        end: new Date(Date.now() + 60_000).toISOString(),
        orderStates: ["OPENED"],
        size: 100,
      })) ?? [];
    // 직원이 연 테이블 주문도 대상 — 그 테이블 계산서에 합치는 게 맞는 동작
    const hit = list.find((o: any) => o?.tableId === tableId || o?.table?.id === tableId);
    return hit?.id;
  } catch (e) {
    remoteLog("warn", `열린 테이블 주문 조회 실패 t${tableId}`, e);
    return undefined;
  }
}

async function createOrAppend(dto: any, tableId: number | undefined): Promise<string | undefined> {
  if (tableId) {
    const known = tableOrders.get(tableId) ?? (await findOpenPosOrder(tableId));
    if (known) {
      try {
        await sdk.order.addMenu(known, dto);
        tableOrders.set(tableId, known);
        return known;
      } catch (e) {
        remoteLog("warn", `addMenu 실패 → 새 주문 생성으로 폴백 t${tableId}`, e);
        tableOrders.delete(tableId); // 닫힌 주문이었을 수 있음 — 캐시 무효화
      }
    }
  }
  const created = await sdk.order.add(dto);
  if (tableId && created?.id) tableOrders.set(tableId, created.id);
  return created?.id;
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
    for (const c of cats) {
      const title = String(c?.title ?? "").trim();
      if (!title) continue;
      catalogIndex.set(`${title}|${catalogPrice(c)}`, c);
      if (!catalogIndex.has(title)) catalogIndex.set(title, c); // 가격 변경 대비 이름 폴백
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
  const hit = tables.find((t) => digits(t?.title) === want);
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

async function ack(orderId: string, outcome: "added" | "unmatched" | "error", tossOrderId?: unknown) {
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
    const n = (addAttempts.get(order.id) ?? 0) + 1;
    addAttempts.set(order.id, n);
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
  try {
    const res = await sdk.http.get(`${FEED_URL}?mid=${merchantId}`, [["x-hsm-plugin-key", PLUGIN_KEY]]);
    if (res?.code !== 200) { remoteLog("warn", `피드 응답 이상 ${res?.code}`); return; }
    const parsed = JSON.parse(res.body ?? "{}");
    if (parsed.demo) {
      await runDemoOnce();
      return;
    }
    for (const o of parsed.orders ?? []) await handle(o);
  } catch (e) {
    remoteLog("error", "피드 조회 실패", e);
  }
}

async function main() {
  const merchant = await sdk.merchant.getMerchant();
  merchantId = Number(merchant?.id ?? merchant?.merchantId);
  console.log("[hsm] 혼술맵 테이블 싱크 시작 — merchant", merchantId);
  remoteLog("info", `플러그인 시작 — merchant ${merchantId}`);
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
  // 주문 완료 시 테이블→주문 캐시 정리 — 결제 후 새 손님은 새 주문(add)으로 열리게
  try {
    sdk.order.on?.("complete", (id: string) => {
      for (const [t, oid] of tableOrders) if (oid === id) tableOrders.delete(t);
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

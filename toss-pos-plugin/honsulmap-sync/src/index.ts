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
const POLL_MS = 2000; // v5.3: 5초→2초 — QR 주문→포스 반영 평균 3초→1.5초 (유저 승인 백로그)
const REFRESH_MS = 10 * 60 * 1000;

type FeedItem = { name: string; price: number; qty: number; request?: string | null };
type FeedOrder = { id: string; seat_label: string; total: number; items: FeedItem[]; joinable_after?: string | null };
// 자리이동/재편입 지시 — pos_order_ids(옮길 포스 주문들)를 to_seat 테이블로 재생성+원본 취소.
// joinable_after: 합류 커트라인 (이 시각 이전에 열린 계산서엔 합류 금지 — 유령 방지)
type FeedMove = { id: string; to_seat: string; pos_order_ids: string[]; joinable_after?: string | null };

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
// 결제는 보통 1분 내 끝나므로 ack 없이 두면 다음 폴링(2초)마다 자연 재시도된다.
// 30회(약 60초) 소진 시에만 폴백(ack error → Open API 현황행). 90초 스윕보다 먼저 끝나게.
// (v5.3: 폴링 5초→2초로 줄며 12회=24초로 윈도우가 줄어드는 부작용 → 30회로 보정)
// at = 마지막 시도 시각 — 서버가 피드에서 내린(취소 등) 주문 항목의 누수 청소용 (검수 권고 2)
const addAttempts = new Map<string, { n: number; at: number }>();

const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

// ── 테이블 "열린 주문 1개" 대응 (v3.1) ──
// 토스 테이블은 열린 주문이 이미 있으면 order.add(tableId)를 거부한다 (실측:
// 연속 주문 시 첫 건만 added, 나머지 error→폴백). 두 번째부터는 addMenu로
// 기존 주문에 메뉴를 추가한다 — 직원이 그 테이블에 추가 입력하는 것과 동일.
const tableOrders = new Map<number, string>(); // tableId → 열린 포스 주문 id (캐시)
const staleLogged = new Set<string>(); // 이전 영업분 계산서 경고 — 재시도 스팸 방지 (주문 id별 1회)
let tickCount = 0; // 역방향 싱크 주기 계산용 (5틱마다)

// 영업일 시작(아침 8시 KST) — 열린 테이블 주문 검색 범위
function businessDayStartIso(): string {
  const kst = new Date(Date.now() + 9 * 3600_000);
  const s = new Date(kst);
  if (kst.getUTCHours() < 8) s.setUTCDate(s.getUTCDate() - 1);
  s.setUTCHours(8, 0, 0, 0);
  return new Date(s.getTime() - 9 * 3600_000).toISOString();
}

// 열린 주문 조회 — 포스 API가 30분당 200회로 제한된다 (실측: 한도 초과 시 전면 실패로
// 플러그인이 장님이 되어 "기존 계산서 못 봄 → 합류 실패 → 폴백" 연쇄, 9/11 01:20 좌석17
// 사고). 15초 캐시 + 실패 시 직전 스냅샷 반환으로 호출 예산을 지킨다. force는 반영 검증
// 등 최신 정합이 꼭 필요한 곳만 (add/addMenu 실패 직후 확인).
let openCache: { at: number; data: any[] } = { at: 0, data: [] };
let rateLogAt = 0;
async function fetchOpenOrders(force = false): Promise<any[]> {
  if (!force && Date.now() - openCache.at < 15_000) return openCache.data;
  try {
    const data =
      (await sdk.order.getOrders({
        start: businessDayStartIso(),
        end: new Date(Date.now() + 60_000).toISOString(),
        orderStates: ["OPENED"],
        size: 100,
      })) ?? [];
    openCache = { at: Date.now(), data };
    return data;
  } catch (e) {
    if (Date.now() - rateLogAt > 5 * 60_000) {
      rateLogAt = Date.now();
      remoteLog("warn", "열린 주문 조회 실패 — 직전 스냅샷으로 계속 동작", e);
    }
    return openCache.data; // 빈 배열로 오판하느니 낡은 스냅샷이 낫다
  }
}

// 검수 권고(우선) 반영: 타임아웃/응답 유실 시 재시도가 같은 메뉴를 두 번 넣지 않게,
// 실패하면 "실제로 반영됐는지"를 먼저 확인하고 성공 처리한다.
//  - addMenu 실패 → 대상 주문의 라인 수가 (호출 전 + 추가분) 이상이면 반영된 것
//  - add 실패     → 열린 주문 중 같은 orderKey가 있으면 생성된 것
async function createOrAppend(dto: any, tableId: number | undefined, joinableAfter?: string | null): Promise<string | undefined> {
  if (tableId) {
    const open = await fetchOpenOrders();
    const knownId = tableOrders.get(tableId);
    const onTable = open.filter((o: any) => o?.tableId === tableId || o?.table?.id === tableId);
    // 직원이 연 테이블 주문도 합류 대상 — 단, 이전 영업분 미마감 계산서는 제외.
    // 실측 사고(9/9 01:24 좌석11): 어제 계산서가 남아 있으면 거기 합류돼 전표·테이블
    // 표시 없이 증발한 것처럼 보임 → 체크인(−30분) 이후 열린 계산서에만 합류한다.
    const joinable = onTable.filter(
      (o: any) => !joinableAfter || String(o?.openedAt ?? o?.createdAt ?? "") >= joinableAfter,
    );
    if (onTable.length && !joinable.length && !staleLogged.has(String(onTable[0]?.id))) {
      staleLogged.add(String(onTable[0]?.id));
      const tTitle = tables.find((t) => t?.id === tableId)?.title ?? tableId;
      remoteLog(
        "warn",
        `${tTitle}번 테이블에 이전 손님 계산서가 남아 있어요 — 새 주문은 합치지 않았어요. 포스 주문내역(지난 날짜 포함)에서 그 계산서를 취소해 주세요.`,
      );
    }
    const target = (knownId && joinable.find((o: any) => o?.id === knownId)) || joinable[0];
    if (target) {
      const before = target.lineItems?.length ?? 0;
      try {
        await sdk.order.addMenu(target.id, dto);
        tableOrders.set(tableId, target.id);
        return target.id;
      } catch (e) {
        const after = (await fetchOpenOrders(true)).find((o: any) => o?.id === target.id);
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
    if (created) openCache.data = [...openCache.data, created]; // 15초 캐시에도 즉시 반영 — 연속 주문 합류 지연 방지
    return created?.id;
  } catch (e) {
    const dup = (await fetchOpenOrders(true)).find((o: any) => o?.orderKey === dto.orderKey);
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
    const posId = await createOrAppend(dto, tableId, order.joinable_after);
    addAttempts.delete(order.id);
    console.log("[hsm] 주문 반영 OK", order.id, "→ table", tableId ?? "(미지정)", "posOrder", posId);
    await ack(order.id, "added", posId);
  } catch (e) {
    const n = (addAttempts.get(order.id)?.n ?? 0) + 1;
    addAttempts.set(order.id, { n, at: Date.now() });
    if (n < 30) {
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
      (o: any) =>
        (o?.tableId === toTableId || o?.table?.id === toTableId) &&
        !srcIds.has(String(o?.id)) &&
        (!mv.joinable_after || String(o?.openedAt ?? o?.createdAt ?? "") >= mv.joinable_after),
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
          const after = (await fetchOpenOrders(true)).find((o: any) => o?.id === target.id);
          if (!after || (after.lineItems?.length ?? 0) < before + lines.length) throw e;
          remoteLog("warn", `이동 addMenu 응답 유실 — 반영 확인돼 진행 t${toTableId}`);
        }
      } else {
        target = await sdk.order.add({
          orderKey: mvKey,
          // 주방 전표에 성격이 보이게 태그 — 재생성 전표를 보고 중복 조리하지 않도록.
          // -fb 원본 = 재편입(이미 현황 전표로 접수·조리된 주문의 테이블 정리용)
          memo: `${/-fb$/.test(String(src.orderKey ?? '')) ? '[전표무시-테이블정리] 이미 접수된 주문' : '[자리이동]'} ${src.memo ?? `혼술맵 QR · 좌석 ${mv.to_seat}`}`,
          discounts: [],
          lineItems: lines,
          tableId: toTableId,
        });
        if (target) openCache.data = [...openCache.data, target]; // 캐시 즉시 반영
      }
      const st = src.tableId ?? src.table?.id;
      if (st) tableOrders.delete(st);
    }
    if (target?.id) tableOrders.set(toTableId, String(target.id));
    addAttempts.delete(mv.id);
    // 레이스 근본 해결(v5.3) — 원 주문 "취소 전에" moved ack를 먼저 보낸다. 서버가 remap을
    // 먼저 기록해야 곧 도착할 취소 웹훅을 이동 부산물로 정확히 판별한다 (9/10 00:58 실측:
    // 취소 웹훅이 remap보다 1초 선착해 세션이 오폭 체크아웃됐던 사고의 원인 제거).
    await ack(mv.id, "moved", target?.id);
    remoteLog("info", `자리이동 완료 → 좌석 ${mv.to_seat} (포스 주문 ${srcs.length}건 합류)`);
    for (const src of srcs) {
      // 재편입 원본(-fb 현황행)은 Open API 생성분이라 플러그인이 취소 못 함(채널 제한) —
      // moved ack를 받은 서버가 Open API로 취소한다 (금액 이중 계상 방지 책임 분리)
      if (/-fb$/.test(String(src.orderKey ?? ""))) continue;
      try {
        await sdk.order.cancel(src.id);
      } catch (e) {
        // 취소만 실패(원 테이블 결제 시작 등) — 메뉴는 이미 새 테이블에 반영됨.
        // 재시도하면 중복되므로 완료 처리하고 수동 취소를 로그로 요청.
        remoteLog("error", `자리는 옮겨졌는데 이전 테이블 계산서가 안 지워졌어요 — 포스에서 직접 취소해 주세요 (${src.orderKey})`, e);
      }
    }
    return [];
  } catch (e) {
    const n = (addAttempts.get(mv.id)?.n ?? 0) + 1;
    addAttempts.set(mv.id, { n, at: Date.now() });
    if (n < 30) {
      if (n === 1) remoteLog("warn", `자리이동 일시 실패 — 재시도 시작 (좌석 ${mv.to_seat})`, e);
      return blockedT; // 미완료 — 관련 테이블 주문 투입 보류
    }
    addAttempts.delete(mv.id);
    remoteLog("error", `좌석 ${mv.to_seat} 자리이동을 포스에 자동 반영하지 못했어요 — 포스의 테이블 이동 기능으로 직접 옮겨 주세요.`, e);
    await ack(mv.id, "error");
    return [];
  } finally {
    inflight.delete(mv.id);
  }
}

// ── 역방향 싱크 (v5.2) ── 직원이 포스에서 직접 넣은 테이블 주문(우리 orderKey가 아닌
// 것)을 서버로 보고한다 — 그 좌석에 체크인한 손님의 주문내역·좌석 합계에 반영된다.
// 지문(상태:라인수:합계)이 바뀔 때만 전송해 트래픽을 아끼고, 전송 실패 시 지문을 되돌려
// 다음 틱에 자연 재전송. 닫힌 주문은 지문 캐시에서 청소한다.
const posReported = new Map<string, string>();
const OUR_KEY_RE = /^(Q\d+_|hsm-demo-)|-(fb|retry|mv)$/;

async function reportPosOrders(open: any[]) {
  const openIds = new Set(open.map((o: any) => String(o?.id)));
  for (const k of posReported.keys()) if (!openIds.has(k)) posReported.delete(k);
  const reports: any[] = [];
  for (const o of open) {
    const tid = o?.tableId ?? o?.table?.id;
    if (!o?.id || !tid) continue;
    if (OUR_KEY_RE.test(String(o?.orderKey ?? ""))) continue;
    const table = tables.find((t) => t?.id === tid);
    const seat = digits(table?.title);
    if (!seat) continue;
    const lines = (o.lineItems ?? []).map((li: any) => ({
      name: String(li?.item?.title ?? ""),
      qty: Number(li?.quantity?.value ?? 1),
      price: Number(li?.chargePrice?.value ?? 0),
    }));
    const total = Number(o?.chargePrice?.chargePriceValue ?? lines.reduce((a: number, l: any) => a + l.price, 0));
    const fp = `${o?.orderState}:${lines.length}:${total}`;
    if (posReported.get(String(o.id)) === fp) continue;
    posReported.set(String(o.id), fp);
    reports.push({ id: String(o.id), order_key: o?.orderKey ?? "", seat_label: seat, total, state: o?.orderState, lines });
  }
  if (!reports.length) return;
  try {
    await sdk.http.post(
      FEED_URL,
      { mid: String(merchantId), pos_orders: reports },
      [
        ["Content-Type", "application/json"],
        ["x-hsm-plugin-key", PLUGIN_KEY],
      ],
    );
  } catch (e) {
    for (const r of reports) posReported.delete(r.id); // 다음 변화 감지 때 재전송되게 롤백
    remoteLog("warn", "포스 주문 보고 실패", e);
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
    // 역방향 싱크 — 직원이 포스에서 직접 넣은 주문을 서버로 보고 (변경 시에만 전송).
    // 조회 예산(30분 200회) 보호: 매 틱이 아니라 5틱(≈10초)마다 + 15초 캐시 경유.
    tickCount++;
    if (tickCount % 5 === 0) await reportPosOrders(await fetchOpenOrders());
  } catch (e) {
    remoteLog("error", "피드 조회 실패", e);
  }
}

async function main() {
  const merchant = await sdk.merchant.getMerchant();
  merchantId = Number(merchant?.id ?? merchant?.merchantId);
  console.log("[hsm] 혼술맵 테이블 싱크 시작 — merchant", merchantId);
  // 버전을 로그에 남겨야 포스가 실제 어떤 버전을 로드했는지 서버에서 구분 가능
  remoteLog("info", `플러그인 시작 v5.3 — merchant ${merchantId}`);
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

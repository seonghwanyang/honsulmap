// 테이블 서비스의 "영업일" 경계 — 새벽 6시(KST) 기준.
// 새벽 장사가 전날 장부에 남고, 세션 만료도 같은 경계를 쓴다.

/** 직전 06:00 KST의 UTC ISO 시각 (오늘 영업분 시작점) */
export function businessDayStart(): string {
  const kstNow = new Date(Date.now() + 9 * 3600_000);
  const start = new Date(kstNow);
  if (kstNow.getUTCHours() < 6) start.setUTCDate(start.getUTCDate() - 1);
  start.setUTCHours(6, 0, 0, 0);
  return new Date(start.getTime() - 9 * 3600_000).toISOString();
}

/** 다음 06:00 KST의 UTC ISO 시각 (체크인 세션 만료점) */
export function sessionExpiry(): string {
  const kstNow = new Date(Date.now() + 9 * 3600_000);
  const exp = new Date(kstNow);
  if (kstNow.getUTCHours() >= 6) exp.setUTCDate(exp.getUTCDate() + 1);
  exp.setUTCHours(6, 0, 0, 0);
  return new Date(exp.getTime() - 9 * 3600_000).toISOString();
}

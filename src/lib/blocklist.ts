// 사용자 차단 (App Store 1.2 UGC). 커뮤니티가 익명(닉네임 기반)이라
// 안정적 유저 ID가 없으므로 "닉네임 단위"로 차단한다. 차단하면:
//  1) 그 닉네임의 글·댓글을 내 피드에서 즉시 숨김 (localStorage)
//  2) 개발자에게 신고 접수(알림) — 아래는 저장만, 통보는 호출부에서 /api/reports 로.
const KEY = 'honsul_blocked_nicks';

export function getBlockedNicks(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function isBlockedNick(nick: string | null | undefined): boolean {
  if (!nick) return false;
  return getBlockedNicks().includes(nick);
}

export function blockNick(nick: string): void {
  if (typeof window === 'undefined' || !nick) return;
  const cur = getBlockedNicks();
  if (!cur.includes(nick)) {
    localStorage.setItem(KEY, JSON.stringify([...cur, nick]));
  }
}

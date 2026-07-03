// 비로그인 사용자는 '가게 1곳'의 스토리만 무료로 보고, 그 다음 가게부터는
// 로그인이 필요하다. 처음 연 가게 id를 이 기기에 저장해 그 가게만 무료로 유지
// (같은 가게 재방문은 계속 무료, 다른 가게는 게이트).
const FREE_SPOT_KEY = 'free_story_spot';

export function isFreeStorySpot(spotId: string): boolean {
  try {
    const used = localStorage.getItem(FREE_SPOT_KEY);
    if (!used) return true; // 아직 무료 사용 안 함 → 이 가게가 무료
    return used === spotId; // 같은 가게면 계속 무료
  } catch {
    return false;
  }
}

export function claimFreeStorySpot(spotId: string): void {
  try {
    if (!localStorage.getItem(FREE_SPOT_KEY)) {
      localStorage.setItem(FREE_SPOT_KEY, spotId);
    }
  } catch {
    /* ignore */
  }
}

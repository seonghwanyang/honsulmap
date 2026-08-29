import { useEffect } from 'react';

// 네이티브 하단 배너(AdMob)를 모달이 열려 있는 동안 잠깐 숨긴다.
// 배너는 웹뷰 위에 얹히는 '네이티브' 뷰라 CSS z-index로 못 가린다. 그래서 화면
// 하단을 덮는 모달(로그인·신고 등)의 버튼이 광고에 가려지는 문제(App Store 2.1a)를
// 이벤트로 알려 AdMobBanner가 hideBanner/resumeBanner 하게 한다.
// 중첩 모달도 ref-count로 안전 — 마지막 모달이 닫힐 때만 배너를 되살린다.

export const AD_BANNER_EVENT = 'admob:visibility';

let count = 0;

function emit(visible: boolean) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AD_BANNER_EVENT, { detail: { visible } }));
}

export function suppressAdBanner(): void {
  count += 1;
  if (count === 1) emit(false);
}

export function releaseAdBanner(): void {
  count = Math.max(0, count - 1);
  if (count === 0) emit(true);
}

// 배너가 뒤늦게 로드될 때 '이미 모달이 열려 있는지' 확인용.
export function isAdBannerSuppressed(): boolean {
  return count > 0;
}

// 모달에서 `useSuppressAdBannerWhile(open)` 한 줄로 사용.
export function useSuppressAdBannerWhile(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    suppressAdBanner();
    return () => releaseAdBanner();
  }, [active]);
}

'use client';

import { useEffect } from 'react';
import { track } from '@/lib/analytics';

// PWA 설치 유도 종료 — iOS(App Store)·안드로이드(Play Store) 모두 헤더의
// '앱 받기' 칩(AppDownloadBanner)이 담당한다. 이 컴포넌트는 예전에 홈 화면에
// 추가해둔 사용자들의 실행 추적(pwa_launch_standalone)만 남긴다.

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function AddToHomePrompt() {
  // If the site is running standalone (launched from the home screen), count
  // it once per page load. Fires on any route.
  useEffect(() => {
    if (!isStandalone()) return;
    const ua = navigator.userAgent || '';
    const platform = /iphone|ipad|ipod/i.test(ua)
      ? 'ios'
      : /android/i.test(ua)
        ? 'android'
        : 'desktop';
    track('pwa_launch_standalone', { platform });
  }, []);

  return null;
}

'use client';

import { useEffect } from 'react';

// App Tracking Transparency (App Store 2.1) — iOS/iPadOS에서 앱 실행 직후 추적 동의
// 프롬프트를 "광고와 무관하게" 항상 한 번 띄운다. 기존엔 ATT 요청이 AdMob 배너
// 초기화 흐름 안에 있어, 배너가 뜨지 않는 화면/기기(예: iPad)에선 프롬프트가 아예
// 안 나타났다(2.1 리젝 원인). 여기서 단독으로 요청해 노출을 보장한다.
//   · iOS/iPadOS 전용(안드로이드·웹 no-op)
//   · 앱이 'active'가 될 때까지 대기 — iOS는 비활성 상태의 ATT 요청을 조용히 무시한다
//   · 멱등: 사용자가 한 번 결정하면 iOS가 재프롬프트 없이 현재 상태만 반환
export default function AppTracking() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.getPlatform() !== 'ios') return; // ATT는 iOS/iPadOS만

      try {
        const { App } = await import('@capacitor/app');
        // 앱이 foreground(active)일 때만 프롬프트가 뜬다 — 콜드런치 직후엔 대기.
        if (!(await App.getState()).isActive) {
          await new Promise<void>((resolve) => {
            let done = false;
            const finish = () => {
              if (!done) {
                done = true;
                resolve();
              }
            };
            const timer = setTimeout(finish, 5000); // 안전 타임아웃
            void App.addListener('appStateChange', ({ isActive }) => {
              if (isActive) {
                clearTimeout(timer);
                finish();
              }
            });
          });
        }
        if (cancelled) return;

        // AdMob 플러그인의 ATT 래퍼 사용(별도 의존성 추가 없음). 상태를 결정만 하면
        // 되고, 이후 AdMobBanner의 initialize가 그 결과대로 개인화/비개인화 광고를 낸다.
        const { AdMob } = await import('@capacitor-community/admob');
        await AdMob.requestTrackingAuthorization();
      } catch {
        // ATT 미지원/실패 — 앱 동작에 영향 없음.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}

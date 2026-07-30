'use client';

import { useEffect } from 'react';

// 네이티브 앱에서만 하단 앵커 배너(AdMob)를 띄운다. 웹/PWA에선 no-op.
// 위치: 우리 하단 네비 알약 '위'에 겹치지 않게 — 네비 실제 위치를 측정해 margin-bottom 계산.
// 플러그인/코어는 동적 import라 웹 번들·SSR 경로에서 실행되지 않는다 (PushRegistration과 동일 패턴).

// 실 배너 광고단위 (AdMob 콘솔).
const BANNER_AD_ID: Record<string, string> = {
  ios: 'ca-app-pub-6267939291849854/3316278061', // ios_bot_banner
  android: 'ca-app-pub-6267939291849854/9248748718', // Android_bot_banner
};

// 배치/겹침을 형 폰에서 안전하게 확인하는 동안 true → 구글 테스트 광고(클릭해도 안전, 크기 동일).
// 확인 끝나면 false로 바꿔 '웹만 재배포'하면 실광고 노출 (네이티브 재빌드 불필요).
const IS_TESTING = true;

// 네비를 못 찾은 화면(예: 첫 진입이 /partner)에서도 어떤 기기에서든 네비를 안 덮도록
// 넉넉히 잡는 안전 fallback(px). 네비가 보이는 화면에선 실제 측정값을 쓴다.
const SAFE_MARGIN_FALLBACK = 96;
const GAP_ABOVE_NAV = 8;

function marginAboveNav(): number {
  const nav = document.querySelector('.app-bottom-nav');
  if (!nav) return SAFE_MARGIN_FALLBACK;
  const rect = nav.getBoundingClientRect();
  // 화면 밑에서 네비 top까지 거리 + 여백 → 배너가 네비 위에 붙되 안 겹침.
  return Math.round(window.innerHeight - rect.top + GAP_ABOVE_NAV);
}

export default function AdMobBanner() {
  useEffect(() => {
    let shown = false;
    (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return; // 웹 무시

      const { AdMob, BannerAdPosition, BannerAdSize } = await import(
        '@capacitor-community/admob'
      );

      const platform = Capacitor.getPlatform();
      const adId = BANNER_AD_ID[platform] ?? BANNER_AD_ID.android;

      try {
        // iOS: IDFA 접근 전 ATT(추적 동의) 요청 (iOS14+). 거부해도 광고는 비개인화로 나감.
        if (platform === 'ios') {
          try {
            await AdMob.requestTrackingAuthorization();
          } catch {
            // ATT 미지원/실패 — 광고엔 영향 없음
          }
        }

        // 플러그인 미탑재 구버전 앱(운영사이트를 로드하지만 네이티브에 AdMob 없음)에선
        // initialize가 'not implemented'로 거부됨 → 아래 catch에서 조용히 무시.
        await AdMob.initialize({ initializeForTesting: IS_TESTING });
        await AdMob.showBanner({
          adId,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: marginAboveNav(),
          isTesting: IS_TESTING,
        });
        shown = true;
      } catch {
        // 플러그인 없음/광고 로드 실패 — 앱 동작에 영향 없음.
      }
    })();

    return () => {
      if (!shown) return;
      (async () => {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        const { AdMob } = await import('@capacitor-community/admob');
        try {
          await AdMob.removeBanner();
        } catch {
          // 이미 닫혔으면 무시
        }
      })();
    };
  }, []);

  return null;
}

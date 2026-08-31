'use client';

import { useEffect } from 'react';
import { AD_BANNER_EVENT, isAdBannerSuppressed } from '@/lib/adBanner';

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
// 2026-08-13 실광고 전환. 문제 생기면 true로 되돌려 웹 재배포.
const IS_TESTING = false;

// 네비를 못 찾은 화면(예: 첫 진입이 /partner)에서도 어떤 기기에서든 네비를 안 덮도록
// 넉넉히 잡는 안전 fallback(px). 네비가 보이는 화면에선 실제 측정값을 쓴다.
const SAFE_MARGIN_FALLBACK = 96;
const GAP_ABOVE_NAV = 8;

function marginAboveNav(): number {
  const nav = document.querySelector('.app-bottom-nav');
  if (!nav) return SAFE_MARGIN_FALLBACK;
  const rect = nav.getBoundingClientRect();
  // 네이티브(패치본)가 안드15+ 엣지투엣지에서 제스처바 인셋을 margin에 자체 가산하므로,
  // 여기선 인셋(Capacitor SystemBars가 주입하는 --safe-area-inset-bottom)을 빼고
  // '뷰포트 하단→네비 top 거리 + 여백'만 전달해 중복 가산을 막는다. 비엣지투엣지에선 0이라 무영향.
  const safeBottom =
    parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-bottom'),
    ) || 0;
  return Math.max(0, Math.round(window.innerHeight - rect.top + GAP_ABOVE_NAV - safeBottom));
}

export default function AdMobBanner() {
  useEffect(() => {
    let shown = false;
    let sizeListener: { remove: () => Promise<void> } | null = null;
    let onVis: ((e: Event) => void) | null = null;
    let onFocusChange: (() => void) | null = null;
    let mo: MutationObserver | null = null;
    (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return; // 웹 무시

      const { AdMob, BannerAdPosition, BannerAdSize, BannerAdPluginEvents } = await import(
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

        // 배너 실제 높이를 받아 '배너 윗변의 화면 바닥 기준 높이'(margin+height)를
        // CSS 변수 --admob-banner-top 으로 노출한다. 지도 우하단 FAB(가게제안/현재위치/
        // 목록)이 이 값 위로 자동 상승해 네이티브 배너에 가려지지 않게 한다(웹은 변수 없음→원위치).
        const usedMargin = marginAboveNav();
        sizeListener = await AdMob.addListener(
          BannerAdPluginEvents.SizeChanged,
          (size: { width: number; height: number }) => {
            const h = size?.height ?? 0;
            document.documentElement.style.setProperty(
              '--admob-banner-top',
              h > 0 ? `${usedMargin + h}px` : '0px',
            );
          },
        );

        await AdMob.showBanner({
          adId,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: usedMargin,
          isTesting: IS_TESTING,
        });
        shown = true;

        // ── 콘텐츠 가림 방지 (App Store 2.1a) ────────────────────────────
        // 네이티브 배너는 웹뷰 '위'에 떠서 CSS로 못 가린다. 그래서 (a) 화면을 덮는
        // 모달(fixed·inset-0·z≥10000)이 뜨거나 (b) 입력창에 포커스가 가면(키보드)
        // 자동으로 hideBanner, 사라지면 resumeBanner 한다. 여기에 per-component
        // 명시 suppress(채팅 등)를 OR로 합쳐 하나의 상태로 제어한다.
        let bannerHidden = false;
        let explicitHide = isAdBannerSuppressed();
        let autoHide = false;
        const applyHidden = () => {
          const want = explicitHide || autoHide;
          if (want === bannerHidden) return;
          bannerHidden = want;
          void (want ? AdMob.hideBanner() : AdMob.resumeBanner()).catch(() => {});
        };
        // 화면을 덮는 풀스크린 오버레이(우리 모달 규칙: fixed·inset-0·z≥10000)가 있나?
        const hasBlockingOverlay = () =>
          Array.from(document.body.children).some((el) => {
            const s = getComputedStyle(el);
            if (s.position !== 'fixed') return false;
            if ((parseInt(s.zIndex, 10) || 0) < 10000) return false;
            const r = el.getBoundingClientRect();
            return r.width >= window.innerWidth * 0.9 && r.height >= window.innerHeight * 0.6;
          });
        const isTyping = () => {
          const el = document.activeElement as HTMLElement | null;
          return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
        };
        const evaluate = () => { autoHide = hasBlockingOverlay() || isTyping(); applyHidden(); };
        onVis = (e: Event) => {
          const visible = (e as CustomEvent<{ visible: boolean }>).detail?.visible;
          explicitHide = !(visible ?? true);
          applyHidden();
        };
        window.addEventListener(AD_BANNER_EVENT, onVis);
        onFocusChange = () => evaluate();
        document.addEventListener('focusin', onFocusChange);
        document.addEventListener('focusout', onFocusChange);
        mo = new MutationObserver(() => evaluate());
        mo.observe(document.body, { childList: true });
        evaluate(); // 배너 뜬 시점에 이미 열려 있는 모달/포커스 반영
      } catch {
        // 플러그인 없음/광고 로드 실패 — 앱 동작에 영향 없음.
      }
    })();

    return () => {
      // 배너가 사라지면 FAB도 원위치로.
      document.documentElement.style.removeProperty('--admob-banner-top');
      if (onVis) window.removeEventListener(AD_BANNER_EVENT, onVis);
      if (onFocusChange) {
        document.removeEventListener('focusin', onFocusChange);
        document.removeEventListener('focusout', onFocusChange);
      }
      if (mo) mo.disconnect();
      (async () => {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;
        if (sizeListener) {
          try {
            await sizeListener.remove();
          } catch {
            // 이미 해제됨 — 무시
          }
        }
        if (!shown) return;
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

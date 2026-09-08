import * as Sentry from '@sentry/nextjs';
import { SENTRY_DSN, SENTRY_ENV, SENTRY_ENABLED } from '@/lib/sentry';

// 브라우저(+앱 웹뷰) Sentry 초기화. window.onerror·unhandledrejection·React 렌더 오류를 자동 수집한다.
// Session Replay는 쓰지 않는다 — Clarity가 이미 녹화 중이고, 할당량·개인정보 부담만 늘어난다.
Sentry.init({
  dsn: SENTRY_DSN,
  enabled: SENTRY_ENABLED,
  environment: SENTRY_ENV,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,

  // 우리 코드가 아닌 곳에서 나는 잡음. 광고·분석 스크립트, 브라우저 확장, 배포 직후 옛 청크 로드 실패 등.
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications.',
    /Loading chunk \d+ failed/,
    'ChunkLoadError',
    'Script error.',
    /Non-Error promise rejection captured/,
    /adsbygoogle/,
  ],
  denyUrls: [
    /pagead2\.googlesyndication\.com/,
    /tpc\.googlesyndication\.com/,
    /googleads\.g\.doubleclick\.net/,
    /googletagmanager\.com/,
    /t1\.daumcdn\.net\/kas/, // 카카오 AdFit
    /clarity\.ms/,
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    /^safari(-web)?-extension:\/\//,
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

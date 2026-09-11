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
    // 페이지 이동으로 진행 중 fetch가 취소될 때 iOS 웹뷰가 던지는 것 — 실제 오류 아님 (09-10 첫 알림)
    /AbortError: The operation was aborted/,
    // 우리 번들 밖(filename 없음)에서 나는 참조 오류 — iOS 웹뷰에 끼어든 스크립트 (09-11)
    "Can't find variable: EmptyRanges",
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
  // 스택이 있는 에러는 우리 번들에서 난 것만 받는다 (원본 URL 또는 소스맵용 app:/// 경로).
  // 스택이 아예 없는 이벤트에는 적용되지 않는다.
  allowUrls: [/https?:\/\/(www\.)?honsulmap\.com/, /^app:\/\//],

  beforeSend(event, hint) {
    // iOS 웹뷰가 스택 없이 던지는 DOMException 계열 unhandledrejection(NotSupportedError 등)은
    // 어느 코드에서 났는지 알 수 없어 조치가 불가능하다. 버리지는 않되 warning으로 낮춰
    // "high priority 새 이슈" 메일은 안 오게 한다. 같은 게 쌓이면 Sentry에서 묶어서 본다.
    const ex = event.exception?.values?.[0];
    const noFrames = !ex?.stacktrace?.frames?.length;
    const isRejection = ex?.mechanism?.type === 'onunhandledrejection';
    if (isRejection && noFrames && typeof DOMException !== 'undefined' && hint.originalException instanceof DOMException) {
      event.level = 'warning';
    }
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

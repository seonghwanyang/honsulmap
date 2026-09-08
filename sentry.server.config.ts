import * as Sentry from '@sentry/nextjs';
import { SENTRY_DSN, SENTRY_ENV, SENTRY_ENABLED } from './src/lib/sentry';

// Node 런타임(API 라우트·서버 컴포넌트) Sentry 초기화. src/instrumentation.ts의 register()가 불러온다.
// throw된 에러는 onRequestError로 자동 수집되고, 5xx를 return하는 자리는 src/lib/serverError.ts가 보고한다.
Sentry.init({
  dsn: SENTRY_DSN,
  enabled: SENTRY_ENABLED,
  environment: SENTRY_ENV,
  tracesSampleRate: 0.1,
  // IP·쿠키는 기본으로 보내지 않는다. 인증 헤더와 토스 서명은 명시적으로 지운다.
  sendDefaultPii: false,
  beforeSend(event) {
    const headers = event.request?.headers;
    if (headers) {
      for (const key of Object.keys(headers)) {
        if (/^(authorization|cookie|x-toss-signature)$/i.test(key)) delete headers[key];
      }
    }
    return event;
  },
});

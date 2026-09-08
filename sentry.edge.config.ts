import * as Sentry from '@sentry/nextjs';
import { SENTRY_DSN, SENTRY_ENV, SENTRY_ENABLED } from './src/lib/sentry';

// Edge 런타임(middleware) Sentry 초기화. src/instrumentation.ts의 register()가 불러온다.
Sentry.init({
  dsn: SENTRY_DSN,
  enabled: SENTRY_ENABLED,
  environment: SENTRY_ENV,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});

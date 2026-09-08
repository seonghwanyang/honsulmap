// Sentry 공통 상수 — 서버·엣지·브라우저 init 세 곳이 같은 값을 쓴다.
//
// DSN은 공개값(브라우저 번들에 그대로 실림)이라 코드에 박아도 안전. env로 덮어쓸 수 있게 fallback.
// environment는 Vercel의 VERCEL_ENV(production / preview / development)를 그대로 쓴다.
// NEXT_PUBLIC_VERCEL_ENV는 Vercel이 System env로 자동 노출하고 Next가 브라우저 번들에 인라인한다.
// enabled: 로컬 next dev(NODE_ENV=development)에서는 보내지 않는다 — Preview·Production 빌드만.
export const SENTRY_DSN =
  process.env.NEXT_PUBLIC_SENTRY_DSN ??
  'https://ae0a5dda3bea86a9a3a113252b49bff6@o4510852801429504.ingest.us.sentry.io/4512052176551936';

export const SENTRY_ENV =
  process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development';

export const SENTRY_ENABLED = process.env.NODE_ENV === 'production';

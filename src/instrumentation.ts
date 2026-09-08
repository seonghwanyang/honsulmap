import * as Sentry from '@sentry/nextjs';

// Next 서버 부팅 훅. 런타임별 Sentry 설정을 로드하고, 라우트 핸들러·서버 컴포넌트에서 throw된 에러를
// onRequestError로 Sentry에 넘긴다 (요청 URL·메서드 포함, 쿠키·IP 제외).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;

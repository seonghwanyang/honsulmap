'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

// 루트 레이아웃까지 깨졌을 때의 최후 화면. 레이아웃이 없으니 <html><body>를 직접 그리고,
// globals.css도 로드되지 않으므로 인라인 스타일만 쓴다. 지금까지는 Next 기본 오류 화면이 떴다.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          background: '#ffffff',
          color: '#111827',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", Pretendard, "Noto Sans KR", sans-serif',
        }}
      >
        <main
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 24,
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>잠시 문제가 생겼어요</h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
            오류는 자동으로 기록됐어요. 잠시 후 다시 시도해 주세요.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 8,
              padding: '10px 22px',
              borderRadius: 999,
              border: 0,
              background: '#111827',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            다시 시도
          </button>
        </main>
      </body>
    </html>
  );
}

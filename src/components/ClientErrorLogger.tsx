'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/client';

// 인증 상태 전이 추적 — SIGNED_OUT이 뜨면 직전 이벤트 흐름째 기록한다
// ("로그인하려다 로그아웃된다" 버그의 재현 증거). /api/client-log(DB)와 Sentry 양쪽에 남긴다.
// window 에러·unhandled rejection은 Sentry SDK(instrumentation-client.ts)가 잡으므로 여기서는 더 안 잡는다.
// 세션당 상한으로 폭주 방지.
const MAX_PER_SESSION = 15;
let sent = 0;

function report(level: 'error' | 'warn', msg: string, detail?: unknown) {
  if (sent >= MAX_PER_SESSION) return;
  sent++;
  try {
    void fetch('/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level,
        msg,
        detail:
          detail instanceof Error
            ? `${detail.message}\n${(detail.stack ?? '').slice(0, 400)}`
            : String(detail ?? '').slice(0, 500),
        url: window.location.href,
      }),
      keepalive: true,
    });
  } catch {
    /* 로깅 실패는 무시 */
  }
}

export default function ClientErrorLogger() {
  useEffect(() => {
    // 인증 전이 꼬리표 — 이벤트마다 Sentry breadcrumb, SIGNED_OUT이 뜨면 직전 흐름째 서버·Sentry로.
    const trail: string[] = [];
    const { data: sub } = createBrowserSupabase().auth.onAuthStateChange((event, session) => {
      trail.push(`${new Date().toISOString().slice(11, 19)} ${event}${session ? '' : '(no-sess)'}`);
      if (trail.length > 6) trail.shift();
      Sentry.addBreadcrumb({ category: 'auth', message: event, level: 'info', data: { hasSession: !!session } });
      if (event === 'SIGNED_OUT') {
        report('warn', 'auth SIGNED_OUT', trail.join(' → '));
        Sentry.captureMessage('auth SIGNED_OUT', { level: 'warning', extra: { trail } });
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);
  return null;
}

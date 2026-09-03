'use client';

import { useEffect } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/client';

// 전역 오류 + 인증 상태 전이 원격 로그 — Sentry 전 단계의 자체 수집.
// 잡는 것: window 에러, unhandled rejection, 그리고 SIGNED_OUT(직전 이벤트 흐름 포함
// — "로그인하려다 로그아웃된다" 버그의 재현 증거). 세션당 상한으로 폭주 방지.
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
    const onErr = (e: ErrorEvent) =>
      report('error', (e.message || 'window.onerror').slice(0, 200), e.error ?? `${e.filename}:${e.lineno}`);
    const onRej = (e: PromiseRejectionEvent) => report('error', 'unhandledrejection', e.reason);
    window.addEventListener('error', onErr);
    window.addEventListener('unhandledrejection', onRej);

    // 인증 전이 꼬리표 — SIGNED_OUT이 뜨면 직전 이벤트 흐름째 서버로.
    const trail: string[] = [];
    const { data: sub } = createBrowserSupabase().auth.onAuthStateChange((event, session) => {
      trail.push(`${new Date().toISOString().slice(11, 19)} ${event}${session ? '' : '(no-sess)'}`);
      if (trail.length > 6) trail.shift();
      if (event === 'SIGNED_OUT') report('warn', 'auth SIGNED_OUT', trail.join(' → '));
    });

    return () => {
      window.removeEventListener('error', onErr);
      window.removeEventListener('unhandledrejection', onRej);
      sub.subscription.unsubscribe();
    };
  }, []);
  return null;
}

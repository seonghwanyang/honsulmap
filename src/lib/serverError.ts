import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';

// API 라우트의 5xx 응답 헬퍼.
//
// 이 코드베이스는 에러를 throw하지 않고 `return NextResponse.json({ error }, { status: 500 })`으로
// 조용히 돌려주는 패턴이라, throw만 자동 수집하는 Sentry에는 하나도 안 잡힌다. 그래서 5xx를 돌려줄 땐
// NextResponse.json 대신 serverError()를 쓴다. 응답 모양은 기존과 동일하게 { error: message }이고,
// 돌려주기 직전에 Sentry에 보고하는 것만 다르다.
//
// Supabase PostgrestError는 Error 인스턴스가 아니라 plain object({ message, code, details, hint })라
// Error·객체·문자열을 모두 받는다.

type Level = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
type ErrorLike = { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };

function messageOf(err: unknown): string | null {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as ErrorLike).message;
    return m == null ? null : String(m);
  }
  return null;
}

/** 응답을 바꾸지 않고 Sentry에만 보고. 삼키는 catch나 console.warn 자리에 쓴다. */
export function reportError(
  err: unknown,
  opts?: { level?: Level; fallback?: string; extra?: Record<string, unknown> },
) {
  const message = messageOf(err) ?? opts?.fallback ?? 'Unknown error';
  const error = err instanceof Error ? err : new Error(message);
  const meta = err && typeof err === 'object' && !(err instanceof Error) ? (err as ErrorLike) : null;
  Sentry.captureException(error, {
    level: opts?.level ?? 'error',
    extra: {
      ...(meta ? { code: meta.code, details: meta.details, hint: meta.hint } : {}),
      ...opts?.extra,
    },
  });
}

/**
 * 5xx JSON 응답 + Sentry 보고.
 *   serverError(error)                       → { error: error.message }, 500
 *   serverError(error, { status: 503 })      → 상태 코드만 변경
 *   serverError(err, { fallback: '…' })      → err가 없거나 message가 없을 때의 문구 (기존 `err?.message ?? '…'`)
 *   serverError(err, { message: '…' })       → 보고는 원래 에러로, 응답 문구는 지정한 것으로
 *   serverError(err, { body: { ok: false } })→ 응답 본문 전체를 지정 (기존 모양 유지용)
 */
export function serverError(
  err: unknown,
  opts?: { status?: number; fallback?: string; message?: string; body?: Record<string, unknown> },
): NextResponse {
  const status = opts?.status ?? 500;
  const message = opts?.message ?? messageOf(err) ?? opts?.fallback ?? 'Internal error';
  reportError(err, { fallback: message, extra: { status } });
  return NextResponse.json(opts?.body ?? { error: message }, { status });
}

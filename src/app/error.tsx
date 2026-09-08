'use client';

import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';
import { useEffect } from 'react';

// 페이지 렌더 오류 경계 — 네비·푸터(루트 레이아웃)는 그대로 두고 본문만 이 화면으로 바뀐다.
// 잡힌 에러는 Sentry에 보고한다. 하위 세그먼트에 자체 error.tsx가 없으면 전부 여기로 온다.
export default function Error({
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
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-bold text-gray-900">잠시 문제가 생겼어요</h1>
      <p className="text-sm text-gray-500">오류는 자동으로 기록됐어요. 잠시 후 다시 시도해 주세요.</p>
      <div className="mt-2 flex gap-2">
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-full bg-gray-900 text-white text-sm font-semibold"
        >
          다시 시도
        </button>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-full border border-gray-200 text-gray-900 text-sm font-semibold"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}

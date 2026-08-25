'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';

// 버그/점검 공지 팝업. 앱/사이트 열면 1회 표시, '확인'(또는 바깥 탭)하면 다시 안 뜸.
// - 메시지를 바꿀 땐 NOTICE_ID도 함께 바꾸면 이미 본 유저에게도 다시 뜬다.
// - 공지를 내릴 땐 layout.tsx 에서 <NoticeModal /> 한 줄만 제거하면 됨.
const NOTICE_ID = '2026-06-17-stories';
const NOTICE_TITLE = '안내';
const NOTICE_TEXT =
  '일부 가게의 실시간 현황 업데이트가 일시적으로 지연되고 있어요. 빠르게 복구 중이니 조금만 기다려 주세요 🙏';

export default function NoticeModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(`notice:${NOTICE_ID}`) !== 'dismissed') setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  if (!mounted || !open) return null;
  // 소비자 공지 — 어드민/파트너 화면에선 띄우지 않음
  if (pathname.startsWith('/admin') || pathname.startsWith('/partner')) return null;

  const close = () => {
    try {
      localStorage.setItem(`notice:${NOTICE_ID}`, 'dismissed');
    } catch {
      // localStorage 막혀도 닫기
    }
    setOpen(false);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={close}
    >
      <div
        className="w-full max-w-sm bg-white"
        style={{ borderRadius: 18, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-7 pb-2 text-center">
          <div aria-hidden style={{ fontSize: 30, lineHeight: 1, marginBottom: 12 }}>
            📢
          </div>
          <h2 className="font-bold" style={{ color: '#111827', fontSize: 17, letterSpacing: '-0.3px' }}>
            {NOTICE_TITLE}
          </h2>
          <p style={{ color: '#6b7280', fontSize: 13, marginTop: 10, lineHeight: 1.6 }}>
            {NOTICE_TEXT}
          </p>
        </div>

        <div className="px-6 pt-3 pb-6">
          <button
            type="button"
            onClick={close}
            className="w-full"
            style={{
              height: 48,
              borderRadius: 12,
              background: '#111827',
              color: '#fff',
              fontSize: 14.5,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { useUser } from '@/lib/useUser';
import ChatRoom from '@/components/chat/ChatRoom';
import { useSuppressAdBannerWhile } from '@/lib/adBanner';

// 가게별 채팅(#6) — 플로팅 런처 + 윈도우(FB 메신저 풍). 패널 인라인 '채팅 입장'을
// 대체. 방이 open일 때만 ChatEntry가 렌더한다. 실제 대화는 ChatRoom 재사용.
//
// 레이어: 패널(z-25) 위, LoginModal(z-10000) 아래 → z-60. 로그인 게이트는
// ChatRoom 내부 onNeedLogin/LoginModal 그대로 동작(여기선 건드리지 않음).

interface Props {
  spotId: string;
  spotName: string;
  notice: string | null;
  // ChatEntry가 이미 조회한 메시지 수 — 런처가 다시 조회하지 않도록 시드값으로 받는다.
  initialCount: number;
  // 사장님이면 채팅창 안에서 메시지 삭제 가능.
  canModerate: boolean;
}

// 큰 수는 99+로 — 배지 폭 고정.
function fmtCount(n: number): string {
  return n > 99 ? '99+' : String(n);
}

export default function ChatLauncher({ spotId, spotName, notice, initialCount, canModerate }: Props) {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  // 윈도우 열림 여부의 최신값 — Realtime 콜백(클로저)에서 참조.
  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  // 채팅 창이 열려 있는 동안 하단 광고 배너를 숨긴다(메시지 입력창 가림 방지).
  useSuppressAdBannerWhile(open);

  // 윈도우가 닫혀 있을 때도 배지를 라이브로 — 이 방의 INSERT만 구독해 +1.
  // 로그인 유저만(RLS authenticated). 윈도우가 열려 있으면 ChatRoom의 onCount가
  // 권위값이므로 여기서는 무시(중복 증가 방지).
  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`chat-badge:${spotId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `spot_id=eq.${spotId}` },
        () => {
          if (!openRef.current) setCount((c) => c + 1);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, spotId]);

  // 윈도우가 열려 있는 동안 ChatRoom이 보고하는 메시지 배열 길이를 권위값으로.
  const handleCount = useCallback((n: number) => {
    setCount(n);
  }, []);

  return (
    <>
      {/* 런처 — 좌상단 고정, 패널/지도 위로 부유. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? '채팅 닫기' : `${spotName} 채팅 열기`}
        style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top) + 12px)',
          left: 12,
          zIndex: 60,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: '#111827',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 6px 20px rgba(17, 24, 39, 0.32)',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {open ? (
          // 열린 상태 → X 로 토글 어포던스.
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          // 메시지 버블 아이콘(이모지 아님).
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        )}

        {/* 메시지 수 배지 — 우상단, count > 0 일 때만. */}
        {count > 0 && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 20,
              height: 20,
              padding: '0 5px',
              borderRadius: 10,
              background: '#ea580c',
              color: '#fff',
              fontSize: 11,
              fontWeight: 800,
              lineHeight: '20px',
              textAlign: 'center',
              boxShadow: '0 0 0 2px #fff',
              boxSizing: 'border-box',
            }}
          >
            {fmtCount(count)}
          </span>
        )}
      </button>

      {/* 윈도우 — 런처 바로 아래 좌상단 앵커. 화면 밖으로 안 넘치게 bound. */}
      {open && (
        <div
          role="dialog"
          aria-label={`${spotName} 채팅`}
          style={{
            position: 'fixed',
            top: 'calc(env(safe-area-inset-top) + 72px)',
            left: 12,
            zIndex: 60,
            width: 'min(92vw, 380px)',
            height: 'min(70vh, 560px)',
            maxWidth: 'calc(100vw - 24px)',
            background: '#fff',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 12px 40px rgba(17, 24, 39, 0.28)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* 윈도우 헤더 — 가게명 + 닫기(X). ChatRoom의 자체 헤더는 embedded로 숨김. */}
          <div
            className="flex items-center justify-between"
            style={{ padding: '11px 14px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="truncate" style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                {spotName} 채팅
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center"
              style={{ color: '#9ca3af', background: '#f3f4f6', borderRadius: '50%', border: 'none', cursor: 'pointer' }}
              aria-label="채팅 닫기"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* 대화 — 기존 ChatRoom 재사용(높이 채움, 자체 헤더 숨김). */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <ChatRoom
              spotId={spotId}
              spotName={spotName}
              notice={notice}
              onClose={() => setOpen(false)}
              embedded
              onCount={handleCount}
              canModerate={canModerate}
            />
          </div>
        </div>
      )}
    </>
  );
}

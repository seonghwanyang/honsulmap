'use client';

import { useEffect, useState } from 'react';

// 앱 다운로드 배너 — 현재 iOS만 출시라 iOS 브라우저에서만 노출.
// 숨김 조건: ① 네이티브 앱 안(웹뷰, window.Capacitor) ② 홈화면 PWA(standalone)
// ③ 닫은 지 7일 이내(localStorage). 안드로이드 출시되면 스토어 분기 추가.
// URL 미설정이면 아무것도 렌더하지 않는다(배포 안전장치).

const APP_STORE_URL = 'https://apps.apple.com/kr/app/id6781643324';
const DISMISS_KEY = 'app_banner_dismissed_at';
const DISMISS_DAYS = 7;

export default function AppDownloadBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!APP_STORE_URL) return;
    try {
      const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const inApp = !!(window as unknown as { Capacitor?: unknown }).Capacitor;
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        !!(navigator as unknown as { standalone?: boolean }).standalone;
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      const dismissed = Date.now() - dismissedAt < DISMISS_DAYS * 86400000;
      setShow(isIos && !inApp && !standalone && !dismissed);
    } catch {
      /* ignore */
    }
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  return (
    <aside
      role="region"
      aria-label="앱 다운로드 안내"
      className="fixed left-3 right-3 z-[9998] flex items-center gap-2.5"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 58px)', // BottomNav 알약 위
        maxWidth: 480,
        margin: '0 auto',
        background: 'rgba(17, 24, 39, 0.96)',
        backdropFilter: 'blur(8px)',
        borderRadius: 14,
        padding: '10px 12px',
        boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon-192.png"
        alt=""
        aria-hidden="true"
        width={34}
        height={34}
        style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0 }}
      />
      <div className="flex-1 min-w-0">
        <p className="truncate" style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: 0 }}>
          혼술맵 앱이 나왔어요
        </p>
        <p className="truncate" style={{ fontSize: 11, color: '#9ca3af', margin: '1px 0 0' }}>
          실시간 현황을 더 빠르게, 앱에서
        </p>
      </div>
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noreferrer noopener"
        style={{ flexShrink: 0, background: '#fff', color: '#111827', fontSize: 12.5, fontWeight: 800, borderRadius: 999, padding: '8px 14px', textDecoration: 'none' }}
      >
        받기
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label="앱 다운로드 배너 닫기"
        style={{ flexShrink: 0, width: 28, height: 28, display: 'grid', placeItems: 'center', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 0 }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>
    </aside>
  );
}

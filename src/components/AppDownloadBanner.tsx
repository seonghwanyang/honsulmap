'use client';

import { useEffect, useState } from 'react';

// 앱 다운로드 칩 — 지도 헤더 우측(내 정보 옆)에 붙는 컴팩트 버튼.
// 현재 iOS만 출시라 iOS 브라우저에서만 노출. 숨김: ① 네이티브 앱 안(웹뷰,
// window.Capacitor) ② 홈화면 PWA(standalone). 안드로이드 출시 시 스토어 분기.

const APP_STORE_URL = 'https://apps.apple.com/kr/app/id6781643324';

export default function AppDownloadBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const isIos = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const inApp = !!(window as unknown as { Capacitor?: unknown }).Capacitor;
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        !!(navigator as unknown as { standalone?: boolean }).standalone;
      setShow(isIos && !inApp && !standalone);
    } catch {
      /* ignore */
    }
  }, []);

  if (!show) return null;

  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="App Store에서 혼술맵 앱 받기"
      className="flex items-center gap-1"
      style={{
        height: 32,
        padding: '0 11px',
        borderRadius: 999,
        background: '#111827',
        color: '#fff',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '-0.2px',
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <svg width="12" height="14" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
      </svg>
      앱 받기
    </a>
  );
}

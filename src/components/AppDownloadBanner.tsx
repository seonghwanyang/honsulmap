'use client';

import { useEffect, useState } from 'react';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/appStore';

// 앱 다운로드 칩 — 지도 헤더 우측(내 정보 옆)에 붙는 컴팩트 버튼.
// 웹 방문자에게 스토어 앱 설치 유도: 안드로이드→Play Store, 그 외(iOS·PC)→App Store.
// 숨김: ① 네이티브 앱 안(웹뷰, window.Capacitor) ② 홈화면 PWA(standalone).

export default function AppDownloadBanner() {
  const [store, setStore] = useState<'ios' | 'android' | null>(null);

  useEffect(() => {
    try {
      const inApp = !!(window as unknown as { Capacitor?: unknown }).Capacitor;
      const standalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        !!(navigator as unknown as { standalone?: boolean }).standalone;
      if (inApp || standalone) return;
      setStore(/Android/i.test(navigator.userAgent) ? 'android' : 'ios');
    } catch {
      /* ignore */
    }
  }, []);

  if (!store) return null;

  return (
    <a
      href={store === 'android' ? PLAY_STORE_URL : APP_STORE_URL}
      target="_blank"
      rel="noreferrer noopener"
      aria-label={
        store === 'android'
          ? 'Google Play에서 혼술맵 앱 받기'
          : 'App Store에서 혼술맵 앱 받기'
      }
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
      {store === 'android' ? (
        <svg width="12" height="13" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
          <path d="M325.3 234.3 104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
        </svg>
      ) : (
        <svg width="12" height="14" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true">
          <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
        </svg>
      )}
      앱 받기
    </a>
  );
}

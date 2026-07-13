'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

// 안드로이드 하드웨어 백버튼 처리: 뒤로 갈 히스토리가 있으면 history.back()
// (→ useBackClose의 popstate로 모달·시트가 닫히거나 이전 화면으로 이동),
// 루트면 앱을 백그라운드로 내린다(종료 대신). iOS/웹에선 no-op.
export default function AndroidBackHandler() {
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    let cleanup: (() => void) | undefined;
    (async () => {
      const { App } = await import('@capacitor/app');
      const handle = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack || window.history.length > 1) {
          window.history.back();
        } else {
          void App.exitApp();
        }
      });
      cleanup = () => {
        void handle.remove();
      };
    })();
    return () => cleanup?.();
  }, []);

  return null;
}

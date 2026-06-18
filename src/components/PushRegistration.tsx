'use client';

import { useEffect } from 'react';

// 네이티브 앱에서만 FCM 푸시 토큰을 등록하고 백엔드(/api/devices)에 저장한다.
// 웹(브라우저)에선 Capacitor.isNativePlatform()===false라 아무것도 하지 않음.
// 플러그인은 동적 import라 웹 번들/SSR 경로에서 실행되지 않는다.
export default function PushRegistration() {
  useEffect(() => {
    let active = true;
    (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!Capacitor.isNativePlatform()) return; // 웹은 무시

      const { PushNotifications } = await import('@capacitor/push-notifications');

      // 토큰 수신 → 백엔드 저장 (register 전에 리스너 먼저 등록)
      await PushNotifications.addListener('registration', async (token) => {
        if (!active) return;
        try {
          await fetch('/api/devices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: token.value, platform: Capacitor.getPlatform() }),
          });
        } catch {
          // 네트워크 실패는 조용히 무시 — 다음 앱 실행 때 다시 등록된다.
        }
      });
      await PushNotifications.addListener('registrationError', () => {});

      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') return;
      await PushNotifications.register();
    })();

    return () => {
      active = false;
    };
  }, []);

  return null;
}

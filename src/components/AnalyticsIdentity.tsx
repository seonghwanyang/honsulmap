'use client';

import { useEffect } from 'react';
import { useUser } from '@/lib/useUser';

// GA4를 "사람 단위 + 앱/웹 구분" 코호트가 가능하게 만든다.
// track()(analytics.ts)은 이벤트만 쏘므로, 여기서 로그인 계정 UUID를 user_id로,
// 로그인여부·표면(web/app)을 user_properties로 set한다.
//  - user_id: 웹↔앱·크로스디바이스의 같은 사람을 하나로 합쳐 리텐션 정확도↑
//  - app_surface: 네이티브 앱(웹뷰)은 GA4가 'web'으로 보므로 별도 속성으로 구분
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

function isNativeApp(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as { Capacitor?: unknown }).Capacitor;
}

export default function AnalyticsIdentity() {
  const { user, loading } = useUser();

  useEffect(() => {
    if (!GA_ID || loading || typeof window === 'undefined') return;
    let tries = 0;
    const apply = () => {
      const gtag = window.gtag;
      if (typeof gtag !== 'function') {
        // gtag 스크립트가 아직 로드 전 — 잠깐 뒤 재시도(최대 ~6초).
        if (tries++ < 20) setTimeout(apply, 300);
        return;
      }
      // send_page_view:false — user_id만 갱신하고 중복 page_view는 막는다.
      gtag('config', GA_ID, { user_id: user?.id ?? undefined, send_page_view: false });
      gtag('set', 'user_properties', {
        logged_in: user ? 'yes' : 'no',
        app_surface: isNativeApp() ? 'app' : 'web',
      });
    };
    apply();
  }, [user, loading]);

  return null;
}

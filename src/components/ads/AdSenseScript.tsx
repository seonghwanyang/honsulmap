'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

// Loads the Google AdSense library so the publisher account can verify the
// site for approval and (once approved) serve Auto Ads. Gated on the env var
// + production so dev/preview builds never load it. Set
// NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX in the Vercel project env.
//
// 네이티브 앱(웹뷰)에서는 로드하지 않는다 — 앱 광고는 AdMob(네이티브 배너)이 담당.
// AdSense까지 이중 로드되면 메인스레드/네트워크 낭비 + 웹 광고가 앱에 섞이는 정책 리스크.
export default function AdSenseScript() {
  const [webOk, setWebOk] = useState(false);
  useEffect(() => {
    import('@capacitor/core')
      .then(({ Capacitor }) => {
        if (!Capacitor.isNativePlatform()) setWebOk(true);
      })
      .catch(() => setWebOk(true)); // capacitor 미탑재 번들 = 웹
  }, []);

  if (!ADSENSE_CLIENT) return null;
  if (process.env.NODE_ENV !== 'production') return null;
  if (!webOk) return null;
  return (
    <Script
      id="adsense-init"
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
    />
  );
}

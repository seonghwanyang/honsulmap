'use client';

import Script from 'next/script';

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

// Loads the Google AdSense library so the publisher account can verify the
// site for approval and (once approved) serve Auto Ads. Gated on the env var
// + production so dev/preview builds never load it. Set
// NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX in the Vercel project env.
export default function AdSenseScript() {
  if (!ADSENSE_CLIENT) return null;
  if (process.env.NODE_ENV !== 'production') return null;
  return (
    <Script
      id="adsense-init"
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
    />
  );
}

import type { MetadataRoute } from 'next';

// Web App Manifest — makes the site installable / "홈 화면에 추가" with a
// proper app name, icon and standalone (no browser chrome) launch. Next
// serves this at /manifest.webmanifest and auto-links it in <head>.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '혼술맵',
    short_name: '혼술맵',
    description: '전국 혼술바·파티·게스트하우스 실시간 현황 지도',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    orientation: 'portrait',
    lang: 'ko',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

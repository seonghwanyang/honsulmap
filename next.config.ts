import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // Let the phone / LAN load dev resources (HMR, RSC, /_next/*) when
  // testing via the PC's LAN IP instead of localhost. Without this, Next 16
  // blocks the cross-origin dev requests, so the page never hydrates —
  // chips don't click and the map's onReady never fires. Dev-only; ignored
  // in production. Update the IP if DHCP reassigns the PC a new one.
  allowedDevOrigins: ['192.168.200.128', '192.168.200.*'],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.cdninstagram.com",
      },
      {
        // IG 영상 스토리 URL은 fbcdn.net (다중 서브도메인) → ** 와일드카드.
        protocol: "https",
        hostname: "**.fbcdn.net",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
    ],
  },
  // Baseline security headers on every response: clickjacking (SAMEORIGIN),
  // MIME-sniffing (nosniff), referrer leakage, HTTPS pinning (HSTS), and a
  // tight Permissions-Policy. A full script-src CSP is intentionally omitted —
  // the app loads several third-party scripts (Naver Maps, GA, Clarity,
  // AdSense) and Next injects inline hydration scripts, so a strict CSP needs
  // nonce wiring (separate task). XSS is closed at the source via jsonLdScript().
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
        ],
      },
    ];
  },
};

// Sentry 빌드 플러그인 — 소스맵 업로드(원본 줄 번호로 스택 표시) + 광고 차단기 우회 터널.
// SENTRY_AUTH_TOKEN·SENTRY_ORG·SENTRY_PROJECT가 없으면(로컬/미설정) 소스맵 업로드만 건너뛰고 빌드는 계속된다.
// Turbopack 빌드라 automaticVercelMonitors(webpack 전용)는 못 쓰고, day-close 크론은 코드에서 withMonitor로 감싼다.
// 터널 경로(/monitoring)는 middleware matcher(허용 목록)에 없어 가로채이지 않는다.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  // 업로드 뒤 클라이언트 소스맵은 배포물에서 지운다(원본 코드 노출 방지). 서버 쪽은 런타임 보고에 필요해 유지됨.
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  telemetry: false,
});

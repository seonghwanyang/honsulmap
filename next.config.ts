import type { NextConfig } from "next";

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

export default nextConfig;

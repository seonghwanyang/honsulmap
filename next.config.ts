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
};

export default nextConfig;

import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor 셸 설정 (혼술맵 컨슈머 앱).
// 전략: 정적 번들이 아니라 운영 사이트를 그대로 로드한다 (server.url).
//  → 서버 컴포넌트 / API 33개 / 네이버 지도 / next-image가 "이미 동작하는 그대로" 작동.
//  → 배경/근거: docs/capacitor-app-spec.md (Part 2).
const config: CapacitorConfig = {
  appId: 'com.honsulmap.app',
  appName: '혼술맵',
  // server.url을 쓰므로 webDir 번들은 오프라인 폴백 용도(www/index.html).
  webDir: 'www',
  server: {
    // 운영 도메인을 웹뷰로 로드. (개발 중엔 PC LAN 주소로 바꿔 라이브 리로드 가능)
    url: 'https://honsulmap.com',
    androidScheme: 'https',
  },
};

export default config;

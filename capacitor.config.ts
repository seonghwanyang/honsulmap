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
    // OAuth(카카오/구글/네이버) 도메인을 '웹뷰 안'에서 열도록 허용.
    // 없으면 로그인 시 외부 Chrome(주소창=인터넷창)으로 튕긴다.
    // 주의: 구글은 임베디드 웹뷰 로그인을 막을 수 있음(disallowed_useragent) → 별도 검증.
    allowNavigation: [
      // OAuth 시작점: 우리 로그인은 Supabase Auth를 거친다
      // (honsulmap.com → *.supabase.co/auth/v1/authorize → 카카오 → 콜백).
      // 이게 빠지면 첫 hop에서 Chrome으로 튕긴다.
      '*.supabase.co',
      'accounts.kakao.com',
      'kauth.kakao.com',
      'kapi.kakao.com',
      'accounts.google.com',
      'nid.naver.com',
    ],
  },
  plugins: {
    // 상태바/제스처바 아이콘 색. 기본값(DEFAULT)은 폰의 다크모드를 따라가는데,
    // 우리 웹은 항상 흰 배경이라 다크모드 폰에서 흰 아이콘이 흰 바탕에 묻혀 안 보였음
    // (Cap8 targetSdk36 edge-to-edge라 styles.xml statusBarColor는 무시됨).
    // 'Light' = 밝은 배경용 = 어두운 아이콘 고정. Android/iOS 공통.
    SystemBars: {
      style: 'Light',
    },
  },
};

export default config;

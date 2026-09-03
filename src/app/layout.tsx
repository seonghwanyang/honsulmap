import type { Metadata, Viewport } from 'next';
import { GoogleAnalytics } from '@next/third-parties/google';
import './globals.css';
import BottomNav from '@/components/BottomNav';
import Footer from '@/components/Footer';
import ClarityScript from '@/components/analytics/ClarityScript';
import AddToHomePrompt from '@/components/AddToHomePrompt';
import AnalyticsIdentity from '@/components/AnalyticsIdentity';
import PushRegistration from '@/components/PushRegistration';
import AdMobBanner from '@/components/AdMobBanner';
import AndroidBackHandler from '@/components/AndroidBackHandler';
import ClientErrorLogger from '@/components/ClientErrorLogger';
import { jsonLdScript } from '@/lib/utils';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://honsulmap.com';
const SITE_NAME = '혼술맵';
const SITE_TITLE = '혼술맵 | 전국 혼술바·파티·게스트하우스 실시간 현황 지도';
const SITE_DESCRIPTION =
  '전국 혼술바·파티·게스트하우스를 실시간 현황으로. 지금 어디가 핫한지 한눈에. 홍대·강남·광안리·서면·애월·서귀포 등 전국 핫플 추천.';

const KEYWORDS = [
  // 실시간 (USP — 가장 중요)
  '혼술바 실시간', '게하 실시간', '실시간 현황', '실시간 인원',
  '혼술바 분위기', '혼술바 좌석 현황', '게스트하우스 분위기',
  // 핵심 브랜드
  '혼술맵', '혼술', '혼술바', '혼술집', '혼술 추천',
  // ── 제주 ────────────────────────────────────────────────
  '제주 혼술', '제주도 혼술', '제주 혼술바', '제주도 혼술바',
  '제주 게스트하우스', '제주 게하', '게스트하우스 바', '게하 파티', '제주 게하 추천',
  '애월 술집', '애월 혼술', '서귀포 술집', '서귀포 혼술',
  '제주시 술집', '구좌 술집', '한림 술집', '협재 술집', '함덕 술집', '중문 술집',
  '성산 술집', '우도 술집',
  '제주 술집 추천', '제주 바 추천', '제주 감성바', '제주 칵테일바', '제주 와인바',
  '제주 핫플', '제주 핫한 술집', '제주 야경 술집',
  '제주도 여행', '제주 여행', '제주 밤 여행', '제주 감성', '제주 인스타 스팟',
  '제주 데이트', '제주 혼행', '제주 여자 혼술', '제주 혼자 여행',
  // ── 서울 ────────────────────────────────────────────────
  '서울 혼술', '서울 혼술바', '서울 혼술집', '서울 게스트하우스',
  // 마포 (가장 많음 — 홍대 권역)
  '홍대 혼술', '홍대 혼술바', '합정 혼술', '망원 혼술', '상수 혼술', '연남동 혼술',
  '홍대 술집', '합정 술집', '망원 술집',
  // 강남
  '강남 혼술', '강남 혼술바', '신사 혼술', '압구정 혼술', '청담 혼술',
  // 용산
  '이태원 혼술', '이태원 혼술바', '한남동 혼술', '해방촌 혼술',
  // 관악
  '서울대입구 혼술', '신림 혼술', '샤로수길 술집',
  // 광진 / 성동
  '건대 혼술', '성수 혼술',
  // 중구 / 종로
  '을지로 혼술', '명동 혼술', '종로 혼술', '익선동 술집',
  // 영등포 / 송파
  '여의도 혼술', '잠실 혼술',
  // 범주
  '서울 핫플', '서울 핫한 술집', '서울 야경 술집', '서울 감성바',
  '서울 칵테일바', '서울 와인바', '서울 데이트', '서울 혼행',
];

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: '%s | 혼술맵',
  },
  description: SITE_DESCRIPTION,
  keywords: KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: '혼술맵' }],
  creator: '혼술맵',
  publisher: '혼술맵',
  category: '여행·라이프스타일',
  appleWebApp: {
    capable: true,
    title: '혼술맵',
    statusBarStyle: 'default',
  },
  // Legacy iOS (<16.4) reads the apple- prefixed tag for standalone
  // launch; Next now emits only the modern mobile-web-app-capable, so add
  // the old one too for full coverage.
  other: {
    'apple-mobile-web-app-capable': 'yes',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    other: {
      'naver-site-verification': 'fba5778d00734f53c694a6ecbee6631974fe7ee1',
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // 지도 서비스 표준: 페이지 핀치줌 차단(지도 자체 줌만 사용). 안드로이드
  // 크롬·삼성인터넷은 maximum-scale=1을 무시하고 핀치줌을 허용해, 페이지가
  // 확대 상태로 고정되는 사고가 나던 것 방지.
  userScalable: false,
  themeColor: '#ffffff',
  // iOS 노치까지 화면을 쓰고 env(safe-area-inset-*)를 활성화 (헤더 여백용).
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
        inLanguage: 'ko-KR',
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: {
          '@type': 'ImageObject',
          url: `${SITE_URL}/icon.png`,
        },
        sameAs: ['https://www.instagram.com/honsulmap'],
      },
    ],
  };

  return (
    <html lang="ko">
      <body className="max-w-screen-md mx-auto bg-white">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
        />
        <main>{children}</main>
        <Footer />
        <BottomNav />
        <AddToHomePrompt />
        <AnalyticsIdentity />
        <PushRegistration />
        <AdMobBanner />
        <AndroidBackHandler />
        <ClientErrorLogger />
        <ClarityScript />
      </body>
      {GA_ID && <GoogleAnalytics gaId={GA_ID} />}
    </html>
  );
}

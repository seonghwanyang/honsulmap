import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNav from '@/components/BottomNav';
import Footer from '@/components/Footer';
import SideBanner from '@/components/ads/SideBanner';
import BottomStickyBar from '@/components/ads/BottomStickyBar';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://honsulmap.com';
const SITE_NAME = '혼술맵';
const SITE_TITLE = '혼술맵 | 제주도 혼술바·게스트하우스 실시간 스토리';
const SITE_DESCRIPTION =
  '제주도 애월·서귀포·구좌·제주시의 핫한 혼술바와 게스트하우스를 한 지도에서. 인스타 스토리 실시간, 좌석 현황, 가격, 분위기 투표. 제주 여행 혼술 게하 파티 맛집 추천.';

const KEYWORDS = [
  // 핵심
  '혼술맵', '제주 혼술', '제주도 혼술', '제주 혼술바', '제주도 혼술바',
  '혼술', '혼술바', '혼술집', '혼술 추천',
  // 게스트하우스
  '제주 게스트하우스', '제주 게하', '게스트하우스 바', '게하 파티', '제주 게하 추천',
  // 지역
  '애월 술집', '애월 혼술', '서귀포 술집', '서귀포 혼술', '구좌 술집',
  '제주시 술집', '한림 술집', '협재 술집', '중문 술집', '함덕 술집',
  // 범주
  '제주 술집 추천', '제주 바 추천', '제주 감성바', '제주 칵테일바', '제주 와인바',
  '제주 핫플', '핫한 술집', '제주 핫한 술집', '제주 야경 술집',
  // 관광·여행
  '제주도 여행', '제주 여행', '제주 밤 여행', '제주 감성', '제주 인스타 스팟',
  '제주 데이트', '제주 혼행', '제주 여자 혼술', '제주 혼자 여행',
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
  icons: {
    icon: '/favicon.ico',
  },
  verification: {
    other: {
      'naver-site-verification': 'fba5778d00734f53c694a6ecbee6631974fe7ee1',
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#ffffff',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: 'ko-KR',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <html lang="ko">
      <head>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6267939291849854"
          crossOrigin="anonymous"
        />
      </head>
      <body className="max-w-screen-md mx-auto bg-white">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <SideBanner position="left" />
        <SideBanner position="right" />
        <main>{children}</main>
        <Footer />
        <BottomStickyBar />
        <BottomNav />
      </body>
    </html>
  );
}

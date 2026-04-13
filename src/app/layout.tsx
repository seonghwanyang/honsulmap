import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNav from '@/components/BottomNav';

export const metadata: Metadata = {
  title: '혼술맵 - 제주도 혼술바 실시간 현황',
  description: '제주도 혼술바/게스트하우스의 인스타 스토리를 모아보고, 실시간 현황을 공유하는 서비스',
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
  return (
    <html lang="ko">
      <body className="max-w-screen-md mx-auto bg-white">
        <main>{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}

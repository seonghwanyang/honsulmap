import type { Metadata } from 'next';
import PartnerShell from './PartnerShell';

// The 사장님 센터 (owner portal). Lives under /partner today; map
// partner.honsulmap.com → /partner via a middleware host-rewrite at deploy
// time (Vercel domain). noindex everywhere — this is a logged-in area.
//
// This route layout stays a SERVER component so the metadata export below is
// honored. The dashboard chrome (sidebar + mobile nav + logout) needs client
// hooks, so it lives in <PartnerShell> instead.
export const metadata: Metadata = {
  title: '혼술맵 사장님 센터',
  description: '내 가게를 직접 관리하세요 — 정보 수정, 방문 통계, 홍보.',
  robots: { index: false, follow: false },
};

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return <PartnerShell>{children}</PartnerShell>;
}

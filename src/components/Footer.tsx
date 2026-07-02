'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  // Map page is a fullscreen interactive canvas; the owner portal has its own
  // chrome — skip the consumer footer in both.
  if (pathname === '/' || pathname.startsWith('/partner')) return null;

  return (
    <footer
      className="px-4 pt-6 pb-28 text-center"
      style={{ color: '#9ca3af', fontSize: '11px', lineHeight: 1.7 }}
    >
      <div style={{ color: '#6b7280', fontWeight: 600, marginBottom: 2 }}>혼술맵</div>
      <div style={{ marginBottom: 2 }}>
        시냅틱(synaptic) · 대표 양성환 · 사업자등록번호 481-19-02344
      </div>
      <div>
        문의·제휴·업장 문의:{' '}
        <a
          href="mailto:contact@higgsi.com"
          style={{ color: '#374151', textDecoration: 'underline' }}
        >
          contact@higgsi.com
        </a>
        {' · 인스타 '}
        <strong style={{ color: '#374151' }}>@honsulmap</strong>
        {' DM'}
      </div>
      <div className="mt-1">
        <Link href="/about" style={{ color: '#6b7280', textDecoration: 'underline' }}>
          소개
        </Link>
        {' · '}
        <Link href="/faq" style={{ color: '#6b7280', textDecoration: 'underline' }}>
          FAQ
        </Link>
        {' · '}
        <Link href="/terms" style={{ color: '#6b7280', textDecoration: 'underline' }}>
          이용약관
        </Link>
        {' · '}
        <Link href="/privacy" style={{ color: '#6b7280', textDecoration: 'underline' }}>
          개인정보처리방침
        </Link>
        {' · '}
        <Link href="/account-deletion" style={{ color: '#6b7280', textDecoration: 'underline' }}>
          계정 삭제
        </Link>
      </div>
    </footer>
  );
}

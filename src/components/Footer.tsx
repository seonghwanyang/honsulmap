'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const pathname = usePathname();
  // Map page is a fullscreen interactive canvas — skip footer there
  if (pathname === '/') return null;

  return (
    <footer
      className="px-4 pt-6 pb-28 text-center"
      style={{ color: '#9ca3af', fontSize: '11px', lineHeight: 1.7 }}
    >
      <div style={{ color: '#6b7280', fontWeight: 600, marginBottom: 2 }}>혼술맵</div>
      <div>
        문의·건의·기능 제안:{' '}
        <a
          href="mailto:yangseonghwan119@gmail.com"
          style={{ color: '#374151', textDecoration: 'underline' }}
        >
          yangseonghwan119@gmail.com
        </a>
      </div>
      <div>
        업장 문의·스토리 삭제:{' '}
        <a
          href="mailto:contact@higgsi.com"
          style={{ color: '#374151', textDecoration: 'underline' }}
        >
          contact@higgsi.com
        </a>
      </div>
      <div className="mt-1">
        <Link href="/privacy" style={{ color: '#6b7280', textDecoration: 'underline' }}>
          개인정보처리방침
        </Link>
      </div>
    </footer>
  );
}

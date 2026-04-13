'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: '맵', icon: '📍' },
  { href: '/feed', label: '피드', icon: '📷' },
  { href: '/community', label: '커뮤', icon: '💬' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around"
      style={{
        height: '56px',
        background: '#16191E',
        borderTop: '1px solid #2a2d33',
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full"
            style={{ color: isActive ? '#F59E0B' : '#888888' }}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span
              className="text-xs font-medium leading-none"
              style={{ color: isActive ? '#F59E0B' : '#888888' }}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

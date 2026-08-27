'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  {
    href: '/',
    label: '맵',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    ),
  },
  {
    href: '/feed',
    label: '모아보기',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    href: '/benefits',
    label: '혜택',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 12 20 22 4 22 4 12" />
        <rect x="2" y="7" width="20" height="5" />
        <line x1="12" y1="22" x2="12" y2="7" />
        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
      </svg>
    ),
  },
  {
    href: '/community',
    label: '커뮤',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  // The owner portal (사장님 센터) has its own nav (sidebar / drawer) — the
  // consumer nav pill should not float over it. The table service customer
  // page (/t/*) is a standalone in-store experience with its own bottom tabs;
  // the global pill would cover its check-in sheet and nav.
  if (pathname.startsWith('/partner') || pathname.startsWith('/t/')) return null;

  // NOTE: 안드로이드에서 body 레벨 fixed 요소가 네이버 지도 캔버스 레이어 위에
  // 있으면 합성 단계에서 떨어져 안 그려지는 버그가 있다 (로드 직후 0.1초만
  // 보였다 사라지고, 상세 시트의 일반 DOM이 밑에 깔리면 다시 나타남).
  // 대응: will-change-transform으로 독립 GPU 레이어 강제 승격 + backdrop-blur
  // 금지 + transform 없는 left-0/right-0/mx-auto 센터링.
  return (
    <nav
      className="app-bottom-nav fixed left-0 right-0 mx-auto w-fit z-[9999] will-change-transform flex items-center gap-1 px-2 py-1.5 bg-white rounded-full shadow-[0_4px_24px_rgba(0,0,0,0.12)] ring-1 ring-black/5"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium no-underline whitespace-nowrap flex-shrink-0 transition-all duration-200 ${
              isActive
                ? 'bg-gray-100 text-gray-900'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {item.icon}
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

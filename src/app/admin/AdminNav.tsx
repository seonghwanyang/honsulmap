'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  ['/admin', '대시보드'],
  ['/admin/monitor', '모니터'],
  ['/admin/performance', '성과'],
  ['/admin/view-stats', '조회수'],
  ['/admin/spots', '가게'],
  ['/admin/requests', '요청'],
  ['/admin/claims', '사장님'],
  ['/admin/reports', '신고'],
  ['/admin/notices', '공지'],
] as const;

// 현재 페이지 강조 + 좁은 화면에선 가로 스크롤. (폰에서 메뉴가 줄바꿈되며 글자가
// 세로로 쪼개지고 브랜드가 3줄로 접히던 것 — 09-15 390px 실측)
export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 text-xs overflow-x-auto whitespace-nowrap" style={{ scrollbarWidth: 'none' }}>
      {ITEMS.map(([href, label]) => {
        const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className="px-2.5 py-1.5 rounded flex-shrink-0"
            style={{
              color: active ? '#111827' : '#6b7280',
              background: active ? '#f3f4f6' : 'transparent',
              fontWeight: active ? 700 : 400,
              textDecoration: 'none',
            }}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

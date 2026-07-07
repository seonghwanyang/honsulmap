'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';
import {
  ACCENT,
  ACCENT_DARK,
  ACCENT_SOFT,
  GridIcon,
  StoreIcon,
  BellIcon,
  MegaphoneIcon,
  LogoutIcon,
} from './ui';

// Dashboard chrome for the owner portal. Desktop (lg+): a fixed left sidebar
// (brand · nav · account/logout). Mobile (<lg): a sticky top bar with a hamburger
// that drops down a nav sheet. Content sits in a ~1040px column with generous
// padding. This is a CLIENT component (needs usePathname + logout); the route
// layout.tsx stays a server component so its metadata export is preserved.

const SIDEBAR_W = 248;

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  soon?: boolean;
}

const NAV: NavItem[] = [
  { href: '/partner/dashboard', label: '대시보드', icon: <GridIcon /> },
  { href: '/partner/claim', label: '가게 등록', icon: <StoreIcon /> },
  { href: '/partner/notices', label: '공지사항', icon: <BellIcon /> },
  { href: '#', label: '홍보', icon: <MegaphoneIcon />, soon: true },
];

function isActivePath(pathname: string, href: string) {
  if (href === '/partner/dashboard') return pathname === '/partner' || pathname.startsWith('/partner/dashboard');
  return pathname.startsWith(href);
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/partner"
      style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}
      aria-label="혼술맵 사장님 센터"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon-192.png"
        alt=""
        aria-hidden="true"
        width={compact ? 28 : 32}
        height={compact ? 28 : 32}
        style={{
          width: compact ? 28 : 32,
          height: compact ? 28 : 32,
          flexShrink: 0,
          borderRadius: 9,
          objectFit: 'cover',
          boxShadow: '0 2px 8px rgba(17,24,39,0.12)',
        }}
      />
      <span style={{ lineHeight: 1.1 }}>
        <span style={{ display: 'block', fontWeight: 800, fontSize: 14.5, color: '#111827', letterSpacing: '-0.3px' }}>
          혼술맵
        </span>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 11.5, color: ACCENT_DARK, letterSpacing: '0.2px', marginTop: 1 }}>
          사장님 센터
        </span>
      </span>
    </Link>
  );
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const base: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    height: 42,
    padding: '0 12px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: '-0.2px',
    textDecoration: 'none',
    transition: 'background 0.15s ease, color 0.15s ease',
  };

  if (item.soon) {
    return (
      <div style={{ ...base, color: '#9ca3af', cursor: 'default' }} aria-disabled="true">
        <span style={{ display: 'inline-flex', opacity: 0.7 }}>{item.icon}</span>
        <span>{item.label}</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            fontWeight: 700,
            color: '#9ca3af',
            background: '#f3f4f6',
            borderRadius: 6,
            padding: '2px 6px',
          }}
        >
          준비중
        </span>
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      style={{
        ...base,
        color: active ? ACCENT_DARK : '#374151',
        background: active ? ACCENT_SOFT : 'transparent',
      }}
    >
      <span style={{ display: 'inline-flex', color: active ? ACCENT : '#6b7280' }}>{item.icon}</span>
      <span>{item.label}</span>
    </Link>
  );
}

function AccountBox() {
  const logout = async () => {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
  };
  return (
    <button
      type="button"
      onClick={logout}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        width: '100%',
        height: 42,
        padding: '0 12px',
        borderRadius: 10,
        background: '#fff',
        border: '1px solid #e5e7eb',
        color: '#6b7280',
        fontSize: 13.5,
        fontWeight: 600,
        cursor: 'pointer',
        letterSpacing: '-0.2px',
      }}
    >
      <LogoutIcon />
      로그아웃
    </button>
  );
}

export default function PartnerShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#f8f9fa',
        // The app <body> is `max-w-screen-md mx-auto` — a centered phone column,
        // right for the consumer app but wrong for this full-width dashboard
        // (fixed 248px sidebar + content). Break out to the full viewport width
        // so the sidebar and content align instead of being squished/offset.
        width: '100vw',
        position: 'relative',
        left: '50%',
        right: '50%',
        marginLeft: '-50vw',
        marginRight: '-50vw',
      }}
    >
      {/* ---- Desktop sidebar (lg+) ---- */}
      <aside
        className="hidden lg:flex"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: SIDEBAR_W,
          flexDirection: 'column',
          background: '#fff',
          borderRight: '1px solid #e5e7eb',
          padding: '20px 16px',
          zIndex: 30,
        }}
      >
        <div style={{ padding: '4px 8px 20px' }}>
          <Brand />
        </div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {NAV.map((item) => (
            <NavLink key={item.label} item={item} active={isActivePath(pathname, item.href)} />
          ))}
        </nav>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#9ca3af', letterSpacing: '-0.1px', padding: '0 2px' }}>
              도움이 필요하신가요?
            </span>
            <a
              href="mailto:contact@higgsi.com"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: '#f8f9fa', border: '1px solid #eef0f2', textDecoration: 'none' }}
            >
              <span
                className="flex-shrink-0 flex items-center justify-center"
                style={{ width: 30, height: 30, borderRadius: 9, background: '#fff', border: '1px solid #eceef0', color: '#6b7280' }}
                aria-hidden="true"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#374151', letterSpacing: '-0.2px' }}>
                  이메일 문의
                </span>
                <span className="block truncate" style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                  contact@higgsi.com
                </span>
              </span>
            </a>
            <a
              href="https://www.instagram.com/honsulmap/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: '#f8f9fa', border: '1px solid #eef0f2', textDecoration: 'none' }}
            >
              <span
                className="flex-shrink-0 flex items-center justify-center"
                style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(45deg, #f58529, #dd2a7b, #8134af)', color: '#fff' }}
                aria-hidden="true"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </svg>
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#374151', letterSpacing: '-0.2px' }}>
                  인스타 DM
                </span>
                <span className="block truncate" style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                  @honsulmap
                </span>
              </span>
            </a>
          </div>
          <AccountBox />
        </div>
      </aside>

      {/* ---- Mobile top bar (<lg) ---- */}
      <header
        className="lg:hidden"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
          padding: '0 16px',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <Brand compact />
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="메뉴"
          aria-expanded={menuOpen}
          style={{
            width: 40,
            height: 40,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 10,
            border: '1px solid #e5e7eb',
            background: menuOpen ? '#f3f4f6' : '#fff',
            color: '#374151',
            cursor: 'pointer',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {menuOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </header>

      {/* ---- Mobile drawer (<lg) ---- */}
      {menuOpen && (
        <>
          <div
            className="lg:hidden"
            onClick={() => setMenuOpen(false)}
            style={{ position: 'fixed', inset: 0, top: 56, background: 'rgba(17,24,39,0.35)', zIndex: 35 }}
          />
          <div
            className="lg:hidden"
            style={{
              position: 'fixed',
              top: 56,
              left: 0,
              right: 0,
              zIndex: 36,
              background: '#fff',
              borderBottom: '1px solid #e5e7eb',
              padding: '12px 16px 16px',
              boxShadow: '0 12px 24px rgba(17,24,39,0.08)',
            }}
          >
            <nav style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {NAV.map((item) => (
                <NavLink
                  key={item.label}
                  item={item}
                  active={isActivePath(pathname, item.href)}
                  onNavigate={() => setMenuOpen(false)}
                />
              ))}
            </nav>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f1f3' }}>
              <AccountBox />
            </div>
          </div>
        </>
      )}

      {/* ---- Content ---- */}
      {/* A plain <div>, not <main>: the root layout already provides the
          document's single <main>, and nesting one here both is invalid HTML
          and pulls in the global `main { padding-bottom: 80px }` rule. */}
      <div className="lg:pl-[248px]" style={{ minHeight: '100dvh' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 20px 64px' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

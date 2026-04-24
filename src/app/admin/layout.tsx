import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh" style={{ background: '#f8f9fa' }}>
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-4 h-14"
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="font-bold text-[15px]"
            style={{ color: '#111827', textDecoration: 'none' }}
          >
            혼술맵 · Admin
          </Link>
          <nav className="flex items-center gap-1 text-xs">
            <AdminNavLink href="/admin">대시보드</AdminNavLink>
            <AdminNavLink href="/admin/spots">가게</AdminNavLink>
            <AdminNavLink href="/admin/requests">요청</AdminNavLink>
            <AdminNavLink href="/admin/reports">신고</AdminNavLink>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://www.google.com/adsense/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs"
            style={{ color: '#6b7280', textDecoration: 'underline' }}
          >
            AdSense ↗
          </a>
          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs"
            style={{ color: '#6b7280', textDecoration: 'underline' }}
          >
            Vercel ↗
          </a>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

function AdminNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-2.5 py-1.5 rounded"
      style={{ color: '#374151', textDecoration: 'none' }}
    >
      {children}
    </Link>
  );
}

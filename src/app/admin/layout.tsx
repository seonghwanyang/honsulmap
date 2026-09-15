import Link from 'next/link';
import AdminNav from './AdminNav';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh" style={{ background: '#f8f9fa' }}>
      <header
        className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 h-14"
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link
            href="/admin"
            className="font-bold text-[15px] whitespace-nowrap flex-shrink-0"
            style={{ color: '#111827', textDecoration: 'none' }}
          >
            혼술맵 · Admin
          </Link>
          <AdminNav />
        </div>
        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
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

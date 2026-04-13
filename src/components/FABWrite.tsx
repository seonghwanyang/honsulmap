import Link from 'next/link';

export default function FABWrite() {
  return (
    <Link
      href="/write"
      className="fixed z-50 flex items-center justify-center"
      style={{
        bottom: 'calc(56px + 16px)',
        right: '16px',
        width: '52px',
        height: '52px',
        borderRadius: '999px',
        background: '#F59E0B',
        boxShadow: '0 4px 12px rgba(245, 158, 11, 0.4)',
        color: '#ffffff',
        fontSize: '24px',
        fontWeight: 'bold',
        textDecoration: 'none',
      }}
      aria-label="글쓰기"
    >
      +
    </Link>
  );
}

'use client';

import { useRouter } from 'next/navigation';

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="fixed top-4 left-4 z-50 flex items-center justify-center"
      style={{
        width: '40px',
        height: '40px',
        borderRadius: '999px',
        background: 'rgba(22, 25, 30, 0.85)',
        border: '1px solid #3a3d43',
        color: '#ffffff',
        fontSize: '18px',
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
      }}
      aria-label="뒤로가기"
    >
      ←
    </button>
  );
}

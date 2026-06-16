'use client';

import { useState, type ReactNode } from 'react';
import { useUser } from '@/lib/useUser';
import LoginModal from '@/components/LoginModal';
import { ACCENT, Spinner } from './ui';

// Wraps the partner pages: shows a login prompt until the user is signed in
// (reusing the existing Kakao/Google LoginModal + /auth/callback flow). The
// modal sends them back to the current /partner path via ?next.

const FEATURES: { title: string; desc: string; icon: ReactNode }[] = [
  {
    title: '가게 정보 직접 관리',
    desc: '영업시간 · 소개 · 사진을 사장님이 직접 수정',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    ),
  },
  {
    title: '방문 · 조회 통계',
    desc: '얼마나 많은 사람이 내 가게를 봤는지 한눈에',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="m7 14 4-4 3 3 5-6" />
      </svg>
    ),
  },
  {
    title: '홍보 · 노출 확대',
    desc: '혼술맵 안에서 내 가게를 더 많은 손님에게',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
        <path d="M15 8a4 4 0 0 1 0 8" />
      </svg>
    ),
  },
];

export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useUser();
  const [showLogin, setShowLogin] = useState(false);

  if (loading) return <Spinner />;

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0 8px' }}>
        <div style={{ width: '100%', maxWidth: 460 }}>
          <div
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 20,
              boxShadow: '0 1px 2px rgba(17,24,39,0.04)',
              padding: '32px 28px 28px',
              textAlign: 'center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon-192.png"
              alt="혼술맵"
              width={56}
              height={56}
              style={{ width: 56, height: 56, margin: '0 auto', borderRadius: 16, display: 'block' }}
            />
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', letterSpacing: '-0.4px', marginTop: 16 }}>
              사장님 센터
            </h1>
            <p style={{ color: '#6b7280', fontSize: 13.5, marginTop: 8, lineHeight: 1.6 }}>
              내 가게를 혼술맵에서 직접 관리하세요.
              <br />
              시작하려면 로그인이 필요해요.
            </p>

            <button
              onClick={() => setShowLogin(true)}
              style={{
                marginTop: 22,
                width: '100%',
                height: 50,
                borderRadius: 13,
                background: ACCENT,
                color: '#fff',
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: '-0.2px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: `0 4px 14px ${ACCENT}33`,
              }}
            >
              로그인 / 시작하기
            </button>
            <p style={{ color: '#9ca3af', fontSize: 11.5, marginTop: 12, lineHeight: 1.5 }}>
              카카오 · Google 계정으로 바로 시작할 수 있어요.
            </p>
          </div>

          <ul style={{ listStyle: 'none', padding: 0, margin: '16px 0 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {FEATURES.map((f) => (
              <li
                key={f.title}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 14,
                  padding: '13px 15px',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 11, background: '#f8f9fa', color: '#374151', display: 'grid', placeItems: 'center' }}
                >
                  {f.icon}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: '#111827', letterSpacing: '-0.2px' }}>
                    {f.title}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: '#6b7280', marginTop: 2, lineHeight: 1.4 }}>
                    {f.desc}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <LoginModal
          open={showLogin}
          onClose={() => setShowLogin(false)}
          reason="가게를 관리하려면 로그인하세요"
        />
      </div>
    );
  }

  return <>{children}</>;
}

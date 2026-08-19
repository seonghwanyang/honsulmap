'use client';

// 테이블 서비스 베타 게이트 — 화이트리스트 이메일만 통과.
// AuthGate 안쪽에서 쓴다 (로그인은 이미 보장된 상태).

import type { ReactNode } from 'react';
import { useUser } from '@/lib/useUser';
import { isTableTester } from '@/lib/tableTesters';
import { Card, Spinner } from './ui';

export default function TesterGate({ children }: { children: ReactNode }) {
  const { user, loading } = useUser();
  if (loading) return <Spinner />;
  if (!isTableTester(user?.email)) {
    return (
      <Card style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 34 }}>🚧</div>
        <h1 style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginTop: 12 }}>
          준비 중인 기능이에요
        </h1>
        <p style={{ color: '#6b7280', fontSize: 13.5, marginTop: 8, lineHeight: 1.6 }}>
          테이블 서비스는 일부 가게와 먼저 테스트하고 있어요.
          <br />곧 모든 사장님께 열어드릴게요.
        </p>
      </Card>
    );
  }
  return <>{children}</>;
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthGate from '../AuthGate';
import { CopyButton } from '../CopyButton';
import NoticeBanner from '@/components/partner/NoticeBanner';
import {
  ACCENT,
  ACCENT_DARK,
  ACCENT_SOFT,
  Card,
  Chip,
  PageHeader,
  Spinner,
  buttonStyle,
  PlusIcon,
  StoreIcon,
} from '../ui';

interface MemberSpot {
  role: 'owner' | 'manager';
  spot: {
    id: string;
    name: string;
    slug: string;
    region: string;
    category: string;
    vip_until: string | null;
  } | null;
}
interface PendingClaim {
  id: string;
  created_at: string;
  verification_code: string | null;
  spot: { name: string; slug: string } | null;
}
interface MeResponse {
  spots: MemberSpot[];
  pendingClaims: PendingClaim[];
}

const ROLE_LABEL: Record<string, string> = { owner: '사장', manager: '매니저' };

function isVip(until: string | null) {
  return !!until && new Date(until).getTime() > Date.now();
}

function SpotCard({ m }: { m: MemberSpot }) {
  const spot = m.spot!;
  const vip = isVip(spot.vip_until);
  return (
    <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: 44,
            height: 44,
            borderRadius: 12,
            background: vip ? '#fffbeb' : '#f3f4f6',
            color: vip ? '#b45309' : '#6b7280',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <StoreIcon size={20} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span
              style={{
                fontWeight: 700,
                fontSize: 15.5,
                color: '#111827',
                letterSpacing: '-0.3px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {spot.name}
            </span>
            {vip && <Chip tone="vip">★ VIP</Chip>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' }}>
            <Chip tone="accent">{ROLE_LABEL[m.role] ?? m.role}</Chip>
            <span style={{ fontSize: 12.5, color: '#9ca3af' }}>
              {[spot.region, spot.category].filter(Boolean).join(' · ')}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
        <Link
          href={`/partner/spot/${spot.id}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 44,
            borderRadius: 11,
            background: '#111827',
            color: '#fff',
            fontSize: 13.5,
            fontWeight: 700,
            letterSpacing: '-0.2px',
            textDecoration: 'none',
          }}
        >
          가게 관리하기
        </Link>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            href={`/partner/spot/${spot.id}/tables`}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 42,
              borderRadius: 11,
              background: '#fff',
              border: '1px solid #e5e7eb',
              color: '#374151',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '-0.2px',
              textDecoration: 'none',
            }}
          >
            테이블 설정
          </Link>
          <Link
            href={`/partner/spot/${spot.id}/orders`}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 42,
              borderRadius: 11,
              background: '#fff',
              border: '1px solid #e5e7eb',
              color: '#374151',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '-0.2px',
              textDecoration: 'none',
            }}
          >
            주문 보드
          </Link>
        </div>
      </div>
    </Card>
  );
}

function PendingCard({ c }: { c: PendingClaim }) {
  return (
    <Card dashed style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 12, height: '100%' }}>
      <span
        aria-hidden="true"
        style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 12, background: '#fef9c3', color: '#a16207', display: 'grid', placeItems: 'center' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <span
          style={{
            display: 'block',
            fontWeight: 700,
            fontSize: 15,
            color: '#111827',
            letterSpacing: '-0.3px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {c.spot!.name}
        </span>
        {c.verification_code ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <span
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 7, background: ACCENT_SOFT, border: '1px solid #dbeafe' }}
            >
              <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, fontWeight: 800, color: '#111827', letterSpacing: '0.5px' }}>
                {c.verification_code}
              </span>
              <CopyButton text={c.verification_code} />
            </span>
            <a
              href="https://ig.me/m/honsulmap"
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 11.5, fontWeight: 700, color: ACCENT_DARK, textDecoration: 'none' }}
            >
              가게 계정으로 DM →
            </a>
          </div>
        ) : (
          <span style={{ display: 'block', fontSize: 12, color: '#9ca3af', marginTop: 3 }}>
            운영자 확인을 기다리고 있어요
          </span>
        )}
      </div>
      <Chip tone="pending">심사 중</Chip>
    </Card>
  );
}

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 2px 0' }}>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', letterSpacing: '0.2px' }}>{children}</h2>
      {typeof count === 'number' && (
        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#9ca3af', background: '#f3f4f6', borderRadius: 999, padding: '1px 8px' }}>
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card style={{ padding: '48px 24px', textAlign: 'center' }}>
      <span
        aria-hidden="true"
        style={{ width: 64, height: 64, margin: '0 auto', borderRadius: 18, background: ACCENT_SOFT, color: ACCENT, display: 'grid', placeItems: 'center' }}
      >
        <StoreIcon size={30} />
      </span>
      <h2 style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginTop: 18, letterSpacing: '-0.3px' }}>
        아직 등록된 가게가 없어요
      </h2>
      <p style={{ color: '#6b7280', fontSize: 13.5, marginTop: 8, lineHeight: 1.6 }}>
        혼술맵에 등록된 내 가게를 찾아 소유권을 신청하면
        <br />
        여기에서 직접 관리할 수 있어요.
      </p>
      <Link href="/partner/claim" style={{ ...buttonStyle('primary'), marginTop: 22 }}>
        <PlusIcon />
        가게 등록하기
      </Link>
    </Card>
  );
}

function DashboardContent() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/partner/me')
      .then((r) => (r.ok ? r.json() : { spots: [], pendingClaims: [] }))
      .then((d) => setData(d))
      .catch(() => setData({ spots: [], pendingClaims: [] }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Spinner />;
  }

  const spots = (data?.spots ?? []).filter((m) => m.spot);
  const pending = (data?.pendingClaims ?? []).filter((c) => c.spot);
  const empty = spots.length === 0 && pending.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <NoticeBanner />
      <PageHeader
        title="대시보드"
        subtitle="내 가게의 정보 · 통계 · 홍보를 한곳에서 관리하세요."
        action={
          !empty ? (
            <Link href="/partner/claim" style={buttonStyle('outline')}>
              <PlusIcon />
              가게 추가
            </Link>
          ) : undefined
        }
      />

      {empty && <EmptyState />}

      {spots.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionLabel count={spots.length}>내 가게</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {spots.map((m) => (
              <SpotCard key={m.spot!.id} m={m} />
            ))}
          </div>
        </section>
      )}

      {pending.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SectionLabel count={pending.length}>심사 중인 신청</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pending.map((c) => (
              <PendingCard key={c.id} c={c} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <AuthGate>
      <DashboardContent />
    </AuthGate>
  );
}

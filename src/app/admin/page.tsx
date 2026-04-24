'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Counts {
  pendingRequests: number;
  pendingReports: number;
  totalSpots: number;
}

export default function AdminDashboard() {
  const [counts, setCounts] = useState<Counts>({
    pendingRequests: 0,
    pendingReports: 0,
    totalSpots: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [reqRes, repRes, spotsRes] = await Promise.all([
          fetch('/api/admin/spot-requests?status=pending'),
          fetch('/api/admin/reports?status=pending'),
          fetch('/api/admin/spots'),
        ]);
        const [requests, reports, spots] = await Promise.all([
          reqRes.json(),
          repRes.json(),
          spotsRes.json(),
        ]);
        setCounts({
          pendingRequests: Array.isArray(requests) ? requests.length : 0,
          pendingReports: Array.isArray(reports) ? reports.length : 0,
          totalSpots: Array.isArray(spots) ? spots.length : 0,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold" style={{ color: '#111827' }}>
        대시보드
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Stat
          href="/admin/requests"
          label="대기 중 가게 요청"
          value={loading ? '…' : counts.pendingRequests}
          highlight={counts.pendingRequests > 0}
        />
        <Stat
          href="/admin/reports"
          label="대기 중 신고"
          value={loading ? '…' : counts.pendingReports}
          highlight={counts.pendingReports > 0}
        />
        <Stat
          href="/admin/spots"
          label="등록된 가게"
          value={loading ? '…' : counts.totalSpots}
        />
      </div>

      <section>
        <h2 className="font-semibold mb-2" style={{ color: '#111827', fontSize: 14 }}>
          빠른 액션
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Link
            href="/admin/spots/new"
            className="bg-white p-4"
            style={{ border: '1px solid #e5e7eb', borderRadius: 10, textDecoration: 'none' }}
          >
            <div style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>
              새 가게 등록
            </div>
            <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>
              직접 입력해서 바로 등록
            </div>
          </Link>
          <Link
            href="/admin/requests"
            className="bg-white p-4"
            style={{ border: '1px solid #e5e7eb', borderRadius: 10, textDecoration: 'none' }}
          >
            <div style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>
              요청 처리하기
            </div>
            <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>
              이용자 제안 승인/반려
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}

function Stat({
  href,
  label,
  value,
  highlight,
}: {
  href: string;
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className="block p-4"
      style={{
        background: '#ffffff',
        border: highlight ? '1px solid #111827' : '1px solid #e5e7eb',
        borderRadius: 10,
        textDecoration: 'none',
      }}
    >
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>{label}</div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          color: highlight ? '#111827' : '#374151',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </Link>
  );
}

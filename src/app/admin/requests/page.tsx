'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface SpotRequest {
  id: string;
  name: string;
  ig_handle: string | null;
  region: string;
  category: string;
  address: string | null;
  note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_note: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<SpotRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  async function reload() {
    setLoading(true);
    const url =
      tab === 'all'
        ? '/api/admin/spot-requests'
        : `/api/admin/spot-requests?status=${tab}`;
    const res = await fetch(url);
    setRequests(res.ok ? await res.json() : []);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [tab]);

  async function reject(req: SpotRequest) {
    const note = prompt('반려 사유 (선택):') || '';
    const res = await fetch(`/api/admin/spot-requests/${req.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', reviewer_note: note }),
    });
    if (!res.ok) return alert('반려 실패');
    reload();
  }

  async function remove(req: SpotRequest) {
    if (!confirm('요청을 영구 삭제할까요? 기록이 남지 않습니다.')) return;
    const res = await fetch(`/api/admin/spot-requests/${req.id}`, { method: 'DELETE' });
    if (!res.ok) return alert('삭제 실패');
    reload();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold" style={{ color: '#111827' }}>
        가게 등록 요청
      </h1>

      <div className="flex items-center gap-1 text-xs">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              background: tab === t ? '#111827' : '#ffffff',
              color: tab === t ? '#fff' : '#374151',
              border: '1px solid',
              borderColor: tab === t ? '#111827' : '#e5e7eb',
              cursor: 'pointer',
            }}
          >
            {t === 'pending'
              ? '대기'
              : t === 'approved'
                ? '승인'
                : t === 'rejected'
                  ? '반려'
                  : '전체'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-xs" style={{ color: '#9ca3af' }}>
          불러오는 중…
        </div>
      ) : requests.length === 0 ? (
        <div
          className="p-6 text-center text-xs"
          style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 10, color: '#9ca3af' }}
        >
          요청이 없습니다
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <div
              key={r.id}
              className="bg-white p-4"
              style={{ border: '1px solid #e5e7eb', borderRadius: 10 }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ fontWeight: 600, color: '#111827', fontSize: 14 }}>
                      {r.name}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="text-xs space-y-0.5" style={{ color: '#6b7280' }}>
                    <div>
                      {r.region} · {r.category === 'bar' ? '혼술바' : '게하'}
                      {r.ig_handle && (
                        <>
                          {' · '}
                          <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                            @{r.ig_handle}
                          </span>
                        </>
                      )}
                    </div>
                    {r.address && <div>주소: {r.address}</div>}
                    {r.note && <div>메모: {r.note}</div>}
                    <div style={{ color: '#9ca3af', fontSize: 11 }}>
                      제출: {new Date(r.created_at).toLocaleString('ko-KR')}
                      {r.reviewed_at &&
                        ` · 처리: ${new Date(r.reviewed_at).toLocaleString('ko-KR')}`}
                    </div>
                    {r.reviewer_note && (
                      <div style={{ color: '#dc2626', fontSize: 11 }}>
                        반려 사유: {r.reviewer_note}
                      </div>
                    )}
                  </div>
                </div>

                {r.status === 'pending' && (
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <Link
                      href={`/admin/spots/new?from_request=${r.id}`}
                      className="text-xs px-3 py-1.5 text-center"
                      style={{
                        background: '#111827',
                        color: '#fff',
                        borderRadius: 6,
                        textDecoration: 'none',
                      }}
                    >
                      승인·등록
                    </Link>
                    <button
                      onClick={() => reject(r)}
                      className="text-xs px-3 py-1.5"
                      style={{
                        background: 'transparent',
                        color: '#6b7280',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                      }}
                    >
                      반려
                    </button>
                  </div>
                )}
                {r.status !== 'pending' && (
                  <button
                    onClick={() => remove(r)}
                    className="text-xs px-3 py-1.5 flex-shrink-0"
                    style={{
                      background: 'transparent',
                      color: '#dc2626',
                      border: '1px solid #fecaca',
                      borderRadius: 6,
                    }}
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: SpotRequest['status'] }) {
  const map = {
    pending: { label: '대기', bg: '#fef3c7', color: '#92400e' },
    approved: { label: '승인', bg: '#dcfce7', color: '#166534' },
    rejected: { label: '반려', bg: '#fee2e2', color: '#991b1b' },
  } as const;
  const s = map[status];
  return (
    <span
      style={{
        fontSize: 10,
        padding: '2px 6px',
        borderRadius: 4,
        background: s.bg,
        color: s.color,
        fontWeight: 600,
      }}
    >
      {s.label}
    </span>
  );
}

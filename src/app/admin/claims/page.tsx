'use client';

import { useEffect, useState } from 'react';

interface SpotClaim {
  id: string;
  spot_id: string;
  user_id: string;
  role: 'owner' | 'manager';
  evidence: string | null;
  verification_code: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  user_email: string | null;
  spot: { name: string; slug: string; region: string; instagram_id: string | null } | null;
}

const ROLE_LABEL: Record<string, string> = { owner: '사장', manager: '매니저' };

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<SpotClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  async function reload() {
    setLoading(true);
    const url = tab === 'all' ? '/api/admin/spot-claims' : `/api/admin/spot-claims?status=${tab}`;
    const res = await fetch(url);
    setClaims(res.ok ? await res.json() : []);
    setLoading(false);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function approve(c: SpotClaim) {
    if (
      !confirm(
        `"${c.spot?.name ?? '이 가게'}" 소유권을 ${c.user_email ?? c.user_id}에게 부여할까요?\n승인하면 해당 계정이 가게를 관리할 수 있어요.`,
      )
    )
      return;
    const res = await fetch(`/api/admin/spot-claims/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    if (!res.ok) return alert('승인 실패');
    reload();
  }

  async function reject(c: SpotClaim) {
    const note = prompt('반려 사유 (선택):') || '';
    const res = await fetch(`/api/admin/spot-claims/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', reviewer_note: note }),
    });
    if (!res.ok) return alert('반려 실패');
    reload();
  }

  async function remove(c: SpotClaim) {
    if (!confirm('신청을 영구 삭제할까요? 기록이 남지 않습니다.')) return;
    const res = await fetch(`/api/admin/spot-claims/${c.id}`, { method: 'DELETE' });
    if (!res.ok) return alert('삭제 실패');
    reload();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: '#111827' }}>
          사장님 소유권 신청
        </h1>
        <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
          승인하면 신청자 계정이 해당 가게의 사장으로 등록돼 사장님 센터에서 관리할 수 있어요.
        </p>
      </div>

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
            {t === 'pending' ? '대기' : t === 'approved' ? '승인' : t === 'rejected' ? '반려' : '전체'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-xs" style={{ color: '#9ca3af' }}>
          불러오는 중…
        </div>
      ) : claims.length === 0 ? (
        <div
          className="p-6 text-center text-xs"
          style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 10, color: '#9ca3af' }}
        >
          신청이 없습니다
        </div>
      ) : (
        <div className="space-y-2">
          {claims.map((c) => (
            <div key={c.id} className="bg-white p-4" style={{ border: '1px solid #e5e7eb', borderRadius: 10 }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ fontWeight: 600, color: '#111827', fontSize: 14 }}>
                      {c.spot?.name ?? '(삭제된 가게)'}
                    </span>
                    <StatusBadge status={c.status} />
                    <span
                      style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}
                    >
                      {ROLE_LABEL[c.role] ?? c.role}
                    </span>
                  </div>
                  {c.status === 'pending' && c.verification_code && (
                    <div style={{ margin: '6px 0 8px' }}>
                      <div
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 8 }}
                      >
                        <span style={{ fontSize: 10.5, color: '#1d4ed8', fontWeight: 700 }}>DM 코드</span>
                        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, fontWeight: 800, color: '#111827', letterSpacing: '0.5px' }}>
                          {c.verification_code}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 5 }}>
                        이 코드가 적힌 DM을 {c.spot?.instagram_id ? `@${c.spot.instagram_id}` : '가게'} 계정에서 받았으면 승인하세요.
                      </p>
                    </div>
                  )}
                  <div className="text-xs space-y-0.5" style={{ color: '#6b7280' }}>
                    <div>
                      신청자:{' '}
                      <span style={{ color: '#111827', fontWeight: 500 }}>{c.user_email ?? c.user_id}</span>
                    </div>
                    {c.spot && (
                      <div>
                        {c.spot.region}
                        {c.spot.instagram_id && (
                          <>
                            {' · '}
                            <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                              @{c.spot.instagram_id}
                            </span>
                          </>
                        )}
                        {' · '}
                        <a
                          href={`/spot/${c.spot.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#2563eb', textDecoration: 'underline' }}
                        >
                          가게 보기 ↗
                        </a>
                      </div>
                    )}
                    {c.evidence && (
                      <div style={{ color: '#374151' }}>증빙: {c.evidence}</div>
                    )}
                    <div style={{ color: '#9ca3af', fontSize: 11 }}>
                      신청: {new Date(c.created_at).toLocaleString('ko-KR')}
                      {c.reviewed_at && ` · 처리: ${new Date(c.reviewed_at).toLocaleString('ko-KR')}`}
                    </div>
                    {c.reviewer_note && (
                      <div style={{ color: '#dc2626', fontSize: 11 }}>반려 사유: {c.reviewer_note}</div>
                    )}
                  </div>
                </div>

                {c.status === 'pending' ? (
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => approve(c)}
                      className="text-xs px-3 py-1.5"
                      style={{ background: '#111827', color: '#fff', borderRadius: 6 }}
                    >
                      승인
                    </button>
                    <button
                      onClick={() => reject(c)}
                      className="text-xs px-3 py-1.5"
                      style={{ background: 'transparent', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 6 }}
                    >
                      반려
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => remove(c)}
                    className="text-xs px-3 py-1.5 flex-shrink-0"
                    style={{ background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6 }}
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

function StatusBadge({ status }: { status: SpotClaim['status'] }) {
  const map = {
    pending: { label: '대기', bg: '#fef3c7', color: '#92400e' },
    approved: { label: '승인', bg: '#dcfce7', color: '#166534' },
    rejected: { label: '반려', bg: '#fee2e2', color: '#991b1b' },
  } as const;
  const s = map[status];
  return (
    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: s.bg, color: s.color, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

'use client';

import { useEffect, useState } from 'react';

interface ReportRow {
  id: string;
  target_type: 'post' | 'comment';
  target_id: string;
  reason: 'spam' | 'abuse' | 'illegal' | 'other';
  detail: string | null;
  status: 'pending' | 'resolved' | 'dismissed';
  resolver_note: string | null;
  created_at: string;
  resolved_at: string | null;
  target:
    | {
        id: string;
        title?: string;
        content: string;
        nickname: string;
        post_id?: string | null;
        spot_id?: string | null;
        spot?: { slug: string; name: string } | null;
      }
    | null;
}

const REASON_LABEL: Record<ReportRow['reason'], string> = {
  spam: '스팸·광고',
  abuse: '욕설·비방',
  illegal: '불법·음란',
  other: '기타',
};

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pending' | 'resolved' | 'dismissed' | 'all'>('pending');

  async function reload() {
    setLoading(true);
    const url =
      tab === 'all' ? '/api/admin/reports' : `/api/admin/reports?status=${tab}`;
    const res = await fetch(url);
    setReports(res.ok ? await res.json() : []);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [tab]);

  async function resolve(r: ReportRow, deleteTarget: boolean) {
    const confirmMsg = deleteTarget
      ? `${r.target_type === 'post' ? '게시글' : '댓글'}을 삭제하고 신고를 해결 처리할까요? 되돌릴 수 없습니다.`
      : '신고를 해결 처리할까요? (대상은 그대로 유지)';
    if (!confirm(confirmMsg)) return;
    const note = prompt('처리 메모 (선택):') || '';
    const res = await fetch(`/api/admin/reports/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'resolved',
        resolver_note: note,
        delete_target: deleteTarget,
      }),
    });
    if (!res.ok) return alert('처리 실패');
    reload();
  }

  async function dismiss(r: ReportRow) {
    if (!confirm('무효 신고로 기각할까요?')) return;
    const note = prompt('기각 사유 (선택):') || '';
    const res = await fetch(`/api/admin/reports/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed', resolver_note: note }),
    });
    if (!res.ok) return alert('기각 실패');
    reload();
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold" style={{ color: '#111827' }}>
        신고 처리
      </h1>

      <div className="flex items-center gap-1 text-xs">
        {(['pending', 'resolved', 'dismissed', 'all'] as const).map((t) => (
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
              : t === 'resolved'
                ? '처리'
                : t === 'dismissed'
                  ? '기각'
                  : '전체'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-xs" style={{ color: '#9ca3af' }}>
          불러오는 중…
        </div>
      ) : reports.length === 0 ? (
        <div
          className="p-6 text-center text-xs"
          style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 10, color: '#9ca3af' }}
        >
          신고가 없습니다
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div
              key={r.id}
              className="bg-white p-4"
              style={{ border: '1px solid #e5e7eb', borderRadius: 10 }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      style={{
                        fontSize: 10,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: '#f3f4f6',
                        color: '#374151',
                        fontWeight: 600,
                      }}
                    >
                      {r.target_type === 'post' ? '게시글' : '댓글'}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: '#fee2e2',
                        color: '#991b1b',
                        fontWeight: 600,
                      }}
                    >
                      {REASON_LABEL[r.reason]}
                    </span>
                    <StatusBadge status={r.status} />
                    <span style={{ color: '#9ca3af', fontSize: 11 }}>
                      {new Date(r.created_at).toLocaleString('ko-KR')}
                    </span>
                  </div>

                  {/* Target preview */}
                  {r.target ? (
                    <div
                      style={{
                        background: '#f8f9fa',
                        borderRadius: 8,
                        padding: 10,
                        fontSize: 12,
                        color: '#374151',
                        marginBottom: 6,
                      }}
                    >
                      {r.target.title && (
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>
                          {r.target.title}
                        </div>
                      )}
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                        {r.target.content.length > 280
                          ? r.target.content.slice(0, 280) + '…'
                          : r.target.content}
                      </div>
                      <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 4 }}>
                        작성자: {r.target.nickname}
                        {r.target_type === 'comment' && r.target.post_id && (
                          <>
                            {' · '}
                            <a
                              href={`/post/${r.target.post_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#6b7280', textDecoration: 'underline' }}
                            >
                              게시글 열기
                            </a>
                          </>
                        )}
                        {r.target_type === 'comment' && r.target.spot && (
                          <>
                            {' · '}
                            <a
                              href={`/spot/${r.target.spot.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#6b7280', textDecoration: 'underline' }}
                            >
                              {r.target.spot.name} 열기
                            </a>
                          </>
                        )}
                        {r.target_type === 'post' && (
                          <>
                            {' · '}
                            <a
                              href={`/post/${r.target.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#6b7280', textDecoration: 'underline' }}
                            >
                              원문 열기
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      style={{
                        background: '#f8f9fa',
                        borderRadius: 8,
                        padding: 10,
                        fontSize: 11,
                        color: '#9ca3af',
                        marginBottom: 6,
                      }}
                    >
                      대상이 이미 삭제됨
                    </div>
                  )}

                  {r.detail && (
                    <div style={{ fontSize: 11, color: '#6b7280' }}>
                      신고 상세: {r.detail}
                    </div>
                  )}
                  {r.resolver_note && (
                    <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                      처리 메모: {r.resolver_note}
                    </div>
                  )}
                </div>

                {r.status === 'pending' && (
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {r.target && (
                      <button
                        onClick={() => resolve(r, true)}
                        className="text-xs px-3 py-1.5"
                        style={{
                          background: '#dc2626',
                          color: '#fff',
                          borderRadius: 6,
                        }}
                      >
                        대상 삭제
                      </button>
                    )}
                    <button
                      onClick={() => resolve(r, false)}
                      className="text-xs px-3 py-1.5"
                      style={{
                        background: '#111827',
                        color: '#fff',
                        borderRadius: 6,
                      }}
                    >
                      유지·해결
                    </button>
                    <button
                      onClick={() => dismiss(r)}
                      className="text-xs px-3 py-1.5"
                      style={{
                        background: 'transparent',
                        color: '#6b7280',
                        border: '1px solid #e5e7eb',
                        borderRadius: 6,
                      }}
                    >
                      기각
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ReportRow['status'] }) {
  const map = {
    pending: { label: '대기', bg: '#fef3c7', color: '#92400e' },
    resolved: { label: '처리', bg: '#dcfce7', color: '#166534' },
    dismissed: { label: '기각', bg: '#e5e7eb', color: '#374151' },
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

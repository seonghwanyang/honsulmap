'use client';

import { useEffect, useState } from 'react';

// 사장님 공지 작성/관리 (playbook §1.6) — 작성하면 사장 대시보드 배너 +
// /partner/notices 아카이브에 노출. type=popup은 사장에게 1회 팝업.

interface Notice {
  id: string;
  title: string;
  body: string;
  type: 'banner' | 'popup';
  active: boolean;
  created_at: string;
}

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<'banner' | 'popup'>('banner');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  async function reload() {
    setLoading(true);
    const res = await fetch('/api/admin/notices');
    const d = res.ok ? await res.json() : { notices: [] };
    setNotices(d.notices ?? []);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  async function create() {
    if (!title.trim() || !body.trim() || submitting) return;
    setSubmitting(true);
    setErr('');
    const res = await fetch('/api/admin/notices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, type }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      setErr(b.error || '등록 실패');
      return;
    }
    setTitle('');
    setBody('');
    setType('banner');
    reload();
  }

  async function toggle(n: Notice) {
    const res = await fetch(`/api/admin/notices/${n.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !n.active }),
    });
    if (!res.ok) return alert('변경 실패');
    setNotices((prev) => prev.map((x) => (x.id === n.id ? { ...x, active: !n.active } : x)));
  }

  async function remove(n: Notice) {
    if (!confirm('공지를 삭제할까요?')) return;
    const res = await fetch(`/api/admin/notices/${n.id}`, { method: 'DELETE' });
    if (!res.ok) return alert('삭제 실패');
    setNotices((prev) => prev.filter((x) => x.id !== n.id));
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold" style={{ color: '#111827' }}>
          사장님 공지
        </h1>
        <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
          활성 공지 중 최신 1개가 사장 대시보드 배너로 떠요. 전체는 사장 쪽 &quot;지난 공지&quot;에서 보여요.
        </p>
      </div>

      {/* 작성 */}
      <div className="bg-white p-4 space-y-2" style={{ border: '1px solid #e5e7eb', borderRadius: 10 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목 (배너에 표시)"
          className="w-full"
          style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 11px', fontSize: 13, outline: 'none' }}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="내용"
          rows={4}
          className="w-full resize-none"
          style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 11px', fontSize: 13, outline: 'none' }}
        />
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {(
              [
                ['banner', '배너'],
                ['popup', '팝업(중요·1회)'],
              ] as const
            ).map(([v, lbl]) => (
              <button
                key={v}
                type="button"
                onClick={() => setType(v)}
                style={{ padding: '6px 11px', borderRadius: 999, fontSize: 12, fontWeight: type === v ? 700 : 400, background: type === v ? '#111827' : '#fff', color: type === v ? '#fff' : '#6b7280', border: '1px solid', borderColor: type === v ? '#111827' : '#e5e7eb', cursor: 'pointer' }}
              >
                {lbl}
              </button>
            ))}
          </div>
          <button
            onClick={create}
            disabled={submitting || !title.trim() || !body.trim()}
            className="text-xs px-4 py-2"
            style={{ background: submitting || !title.trim() || !body.trim() ? '#9ca3af' : '#111827', color: '#fff', borderRadius: 8, fontWeight: 600 }}
          >
            {submitting ? '등록 중…' : '공지 등록'}
          </button>
        </div>
        {err && <p style={{ color: '#dc2626', fontSize: 12 }}>{err}</p>}
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="text-xs" style={{ color: '#9ca3af' }}>
          불러오는 중…
        </div>
      ) : notices.length === 0 ? (
        <div className="p-6 text-center text-xs" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, color: '#9ca3af' }}>
          공지가 없습니다
        </div>
      ) : (
        <div className="space-y-2">
          {notices.map((n) => (
            <div key={n.id} className="bg-white p-4" style={{ border: '1px solid #e5e7eb', borderRadius: 10 }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ fontWeight: 700, color: '#111827', fontSize: 13.5 }}>{n.title}</span>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: n.type === 'popup' ? '#fee2e2' : '#eff6ff', color: n.type === 'popup' ? '#991b1b' : '#1d4ed8', fontWeight: 700 }}>
                      {n.type === 'popup' ? '팝업' : '배너'}
                    </span>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: n.active ? '#dcfce7' : '#f3f4f6', color: n.active ? '#166534' : '#6b7280', fontWeight: 700 }}>
                      {n.active ? '활성' : '비활성'}
                    </span>
                    <span style={{ color: '#9ca3af', fontSize: 11 }}>
                      {new Date(n.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{n.body}</p>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={() => toggle(n)}
                    className="text-xs px-3 py-1.5"
                    style={{ background: n.active ? 'transparent' : '#111827', color: n.active ? '#6b7280' : '#fff', border: n.active ? '1px solid #e5e7eb' : 'none', borderRadius: 6 }}
                  >
                    {n.active ? '내리기' : '올리기'}
                  </button>
                  <button
                    onClick={() => remove(n)}
                    className="text-xs px-3 py-1.5"
                    style={{ background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6 }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

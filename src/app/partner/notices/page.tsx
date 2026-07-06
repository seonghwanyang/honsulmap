'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// 사장님 공지 아카이브 (playbook §1.6) — 배너에서 닫은 공지도 여기서 다시 본다.
// 리스트 항목 탭 → 본문 아코디언 펼침.

interface Notice {
  id: string;
  title: string;
  body: string;
  type: 'banner' | 'popup';
  created_at: string;
}

export default function PartnerNoticesPage() {
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/partner/notices')
      .then((r) => (r.ok ? r.json() : { notices: [] }))
      .then((d) => setNotices(d.notices ?? []))
      .catch(() => setNotices([]));
  }, []);

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '12px 16px 80px' }}>
      <div className="flex items-center gap-2" style={{ height: 48 }}>
        <Link href="/partner/dashboard" aria-label="대시보드로" style={{ color: '#6b7280', display: 'inline-flex', padding: 4 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h1 style={{ fontSize: 17, fontWeight: 800, color: '#111827', letterSpacing: '-0.3px' }}>공지사항</h1>
      </div>

      {notices === null ? (
        <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '48px 0' }}>불러오는 중…</p>
      ) : notices.length === 0 ? (
        <div style={{ background: '#fff', border: '1px dashed #d1d5db', borderRadius: 14, padding: '36px 20px', textAlign: 'center', marginTop: 8 }}>
          <p style={{ color: '#9ca3af', fontSize: 13 }}>아직 공지가 없어요.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {notices.map((n) => {
            const open = openId === n.id;
            return (
              <div key={n.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : n.id)}
                  className="w-full flex items-center gap-2 text-left"
                  style={{ background: 'none', border: 'none', padding: '13px 14px', cursor: 'pointer' }}
                >
                  <span className="flex-1 min-w-0" style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>
                    {n.title}
                  </span>
                  <span style={{ flexShrink: 0, fontSize: 11, color: '#9ca3af' }}>
                    {new Date(n.created_at).toLocaleDateString('ko-KR')}
                  </span>
                  <span style={{ flexShrink: 0, color: '#9ca3af', fontSize: 11, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                    ▾
                  </span>
                </button>
                {open && (
                  <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, padding: '0 14px 14px', whiteSpace: 'pre-wrap', borderTop: '1px solid #f3f4f6', paddingTop: 12, margin: 0 }}>
                    {n.body}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

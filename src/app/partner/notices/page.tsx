'use client';

import { useEffect, useState } from 'react';
import { Card, PageHeader } from '../ui';

// 사장님 공지 아카이브 (playbook §1.6) — 배너에서 닫은 공지도 여기서 다시 본다.
// PartnerShell(사이드바 셸) 안에서 렌더되므로 자체 뒤로가기 없이 PageHeader+Card로
// 다른 사장님 페이지와 톤을 맞춘다. 항목 탭 → 본문 아코디언 펼침.

interface Notice {
  id: string;
  title: string;
  body: string;
  type: 'banner' | 'popup';
  created_at: string;
}

const NEW_DAYS = 7;

function isNew(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < NEW_DAYS * 86400000;
}

export default function PartnerNoticesPage() {
  const [notices, setNotices] = useState<Notice[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/partner/notices')
      .then((r) => (r.ok ? r.json() : { notices: [] }))
      .then((d) => {
        const list: Notice[] = d.notices ?? [];
        setNotices(list);
        // 최신 1개는 펼쳐서 시작 — 빈 화면 느낌 제거 + 바로 읽게.
        if (list.length > 0) setOpenId(list[0].id);
      })
      .catch(() => setNotices([]));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="공지사항"
        subtitle="혼술맵 새 기능과 운영 소식을 모아뒀어요. 중요한 공지는 대시보드 상단에도 표시돼요."
      />

      <div style={{ maxWidth: 760 }}>
        {notices === null ? (
          <Card style={{ padding: 24 }}>
            <p style={{ fontSize: 13, color: '#9ca3af' }}>불러오는 중…</p>
          </Card>
        ) : notices.length === 0 ? (
          <Card dashed style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ color: '#9ca3af', fontSize: 13.5, lineHeight: 1.6 }}>
              아직 공지가 없어요.
              <br />새 기능이나 소식이 생기면 여기에 올라와요.
            </p>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {notices.map((n) => {
              const open = openId === n.id;
              return (
                <Card key={n.id} style={{ padding: 0, overflow: 'hidden' }}>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : n.id)}
                    className="w-full flex items-center gap-3 text-left"
                    style={{ background: 'none', border: 'none', padding: '16px 18px', cursor: 'pointer' }}
                  >
                    <span
                      className="flex-shrink-0 flex items-center justify-center"
                      style={{ width: 36, height: 36, borderRadius: 10, background: n.type === 'popup' ? '#fee2e2' : '#f3f4f6' }}
                      aria-hidden="true"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={n.type === 'popup' ? '#dc2626' : '#6b7280'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                      </svg>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate" style={{ fontSize: 14.5, fontWeight: 700, color: '#111827', letterSpacing: '-0.2px' }}>
                          {n.title}
                        </span>
                        {n.type === 'popup' && (
                          <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, color: '#dc2626', background: '#fee2e2', borderRadius: 6, padding: '2px 7px' }}>
                            중요
                          </span>
                        )}
                        {isNew(n.created_at) && (
                          <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 800, color: '#ea580c', background: '#fff7ed', borderRadius: 6, padding: '2px 7px' }}>
                            NEW
                          </span>
                        )}
                      </span>
                      <span style={{ display: 'block', fontSize: 12, color: '#9ca3af', marginTop: 3 }}>
                        {new Date(n.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    </span>
                    <span
                      className="flex-shrink-0"
                      style={{ color: '#9ca3af', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
                      aria-hidden="true"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </button>
                  {open && (
                    <div style={{ padding: '0 18px 18px 66px' }}>
                      <p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>
                        {n.body}
                      </p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

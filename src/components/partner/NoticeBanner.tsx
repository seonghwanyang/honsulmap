'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// 사장 대시보드 공지 배너 (playbook §1.6, 2026-07-05 확정안).
//  - 배너: 최신 활성 공지 1개 → [자세히](아코디언 펼침) + [지난 공지 ›](아카이브)
//  - 닫기(X) = 그 공지 읽음 처리(localStorage) → 배너 숨김, 아카이브에는 남음
//  - type=popup: 1회 모달로 먼저 보여주고 확인하면 배너로 강등

interface Notice {
  id: string;
  title: string;
  body: string;
  type: 'banner' | 'popup';
  created_at: string;
}

const dismissKey = (id: string) => `pn_dismiss_${id}`;
const popupKey = (id: string) => `pn_popup_${id}`;

export default function NoticeBanner() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);

  useEffect(() => {
    fetch('/api/partner/notices')
      .then((r) => (r.ok ? r.json() : { notices: [] }))
      .then((d) => {
        const list: Notice[] = d.notices ?? [];
        const latest = list.find((n) => {
          try {
            return !localStorage.getItem(dismissKey(n.id));
          } catch {
            return true;
          }
        });
        if (!latest) return;
        setNotice(latest);
        if (latest.type === 'popup') {
          try {
            if (!localStorage.getItem(popupKey(latest.id))) setPopupOpen(true);
          } catch {
            /* ignore */
          }
        }
      })
      .catch(() => {});
  }, []);

  if (!notice) return null;

  const closePopup = () => {
    try {
      localStorage.setItem(popupKey(notice.id), '1');
    } catch {
      /* ignore */
    }
    setPopupOpen(false);
  };

  const dismiss = () => {
    try {
      localStorage.setItem(dismissKey(notice.id), '1');
    } catch {
      /* ignore */
    }
    setNotice(null);
  };

  return (
    <>
      <div style={{ background: '#eff6ff', border: '1px solid #dbeafe', borderRadius: 12, padding: '10px 14px' }}>
        <div className="flex items-center gap-2">
          <span style={{ fontSize: 12, flexShrink: 0 }} aria-hidden="true">
            📢
          </span>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex-1 min-w-0 text-left truncate"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#1e3a8a' }}
          >
            {notice.title}
          </button>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{ flexShrink: 0, fontSize: 11.5, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', fontWeight: 600 }}
          >
            {expanded ? '접기' : '자세히'}
          </button>
          <Link
            href="/partner/notices"
            style={{ flexShrink: 0, fontSize: 11.5, color: '#6b7280', textDecoration: 'none', padding: '2px 4px' }}
          >
            지난 공지 ›
          </Link>
          <button
            type="button"
            onClick={dismiss}
            aria-label="공지 닫기"
            style={{ flexShrink: 0, color: '#93c5fd', background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>
        {expanded && (
          <p style={{ fontSize: 12.5, color: '#1e40af', lineHeight: 1.6, marginTop: 8, whiteSpace: 'pre-wrap' }}>
            {notice.body}
          </p>
        )}
      </div>

      {/* 중요 공지 1회 팝업 */}
      {popupOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={closePopup}
        >
          <div
            className="w-full max-w-sm bg-white"
            style={{ borderRadius: 16, padding: '22px 20px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#ea580c', letterSpacing: 0.4 }}>혼술맵 공지</div>
            <h2 style={{ fontSize: 16.5, fontWeight: 800, color: '#111827', marginTop: 6, lineHeight: 1.4 }}>
              {notice.title}
            </h2>
            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.7, marginTop: 10, whiteSpace: 'pre-wrap', maxHeight: '50dvh', overflowY: 'auto' }}>
              {notice.body}
            </p>
            <button
              type="button"
              onClick={closePopup}
              style={{ marginTop: 16, width: '100%', height: 46, borderRadius: 11, background: '#111827', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
            >
              확인했어요
            </button>
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { getFingerprint } from '@/lib/utils';
import { blockNick } from '@/lib/blocklist';
import { useBackClose } from '@/lib/useBackClose';

interface Props {
  open: boolean;
  onClose: () => void;
  targetType: 'post' | 'comment' | 'chat_message';
  targetId: string;
  // UGC 차단(App Store 1.2): 작성자 닉네임을 주면 "차단" 버튼이 표시됨.
  authorNickname?: string;
  onBlocked?: () => void;
}

const REASONS = [
  { value: 'spam', label: '스팸·광고' },
  { value: 'abuse', label: '욕설·비방' },
  { value: 'illegal', label: '불법·음란' },
  { value: 'other', label: '기타' },
];

export default function ReportModal({ open, onClose, targetType, targetId, authorNickname, onBlocked }: Props) {
  const [reason, setReason] = useState('spam');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason('spam');
      setDetail('');
      setError('');
      setDone(false);
      setSubmitting(false);
    }
  }, [open]);

  useBackClose(open, onClose);

  if (!open) return null;

  async function submit() {
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          reason,
          detail: detail.trim(),
          fingerprint: getFingerprint(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || '신고에 실패했습니다.');
      }
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  // 사용자 차단: 닉네임을 로컬 차단목록에 추가(피드에서 즉시 숨김) + 개발자에게
  // 신고 접수(부적절 콘텐츠 확인용). App Store 1.2 요건.
  async function block() {
    if (submitting || !authorNickname) return;
    setSubmitting(true);
    try {
      blockNick(authorNickname);
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          reason: 'abuse',
          detail: '사용자 차단',
          fingerprint: getFingerprint(),
        }),
      }).catch(() => {});
      onBlocked?.();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white"
        style={{ borderRadius: 16, maxHeight: '90dvh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <h2 className="font-bold" style={{ color: '#111827', fontSize: 16 }}>
            신고하기
          </h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            style={{ color: '#9ca3af', padding: 4 }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {done ? (
          <div className="px-5 pb-6 pt-4 text-center">
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 14 }}>
              신고가 접수되었습니다.
              <br />
              검토 후 조치됩니다.
            </div>
            <button
              onClick={onClose}
              className="w-full"
              style={{
                background: '#111827',
                color: '#fff',
                padding: '11px 0',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              확인
            </button>
          </div>
        ) : (
          <div className="px-5 pb-5 pt-2 space-y-3">
            <div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 500 }}>
                사유
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {REASONS.map((r) => {
                  const active = reason === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setReason(r.value)}
                      style={{
                        padding: '10px 12px',
                        border: '1px solid',
                        borderColor: active ? '#111827' : '#e5e7eb',
                        borderRadius: 8,
                        background: active ? '#111827' : '#ffffff',
                        color: active ? '#ffffff' : '#374151',
                        fontSize: 13,
                        fontWeight: active ? 600 : 400,
                        textAlign: 'center',
                      }}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>
                상세 (선택)
              </div>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                rows={3}
                placeholder="추가 설명이 있다면 적어주세요."
                className="w-full resize-none"
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: '9px 11px',
                  fontSize: 13,
                  color: '#111827',
                  outline: 'none',
                }}
              />
            </div>

            {error && (
              <div style={{ color: '#dc2626', fontSize: 12 }}>{error}</div>
            )}

            <button
              onClick={submit}
              disabled={submitting}
              className="w-full"
              style={{
                background: submitting ? '#9ca3af' : '#111827',
                color: '#fff',
                padding: '11px 0',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {submitting ? '제출 중…' : '신고 접수'}
            </button>

            {authorNickname && (
              <>
                <button
                  onClick={block}
                  disabled={submitting}
                  className="w-full"
                  style={{
                    background: '#fff',
                    color: '#dc2626',
                    padding: '10px 0',
                    borderRadius: 10,
                    fontSize: 13.5,
                    fontWeight: 600,
                    border: '1px solid #fecaca',
                  }}
                >
                  이 사용자 차단하기
                </button>
                <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', lineHeight: 1.5 }}>
                  차단하면 이 사용자의 글·댓글이 목록에서 바로 숨겨지고 운영자에게 접수됩니다.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

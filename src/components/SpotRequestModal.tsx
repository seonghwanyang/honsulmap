'use client';

import { useEffect, useState } from 'react';
import { getFingerprint } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

const REGIONS = [
  { value: 'jeju', label: '제주시' },
  { value: 'aewol', label: '애월' },
  { value: 'seogwipo', label: '서귀포' },
  { value: 'east', label: '동부(구좌·성산)' },
  { value: 'west', label: '서부(한림·한경)' },
];

const CATEGORIES = [
  { value: 'bar', label: '혼술바' },
  { value: 'guesthouse', label: '게스트하우스' },
];

export default function SpotRequestModal({ open, onClose }: Props) {
  const [name, setName] = useState('');
  const [igHandle, setIgHandle] = useState('');
  const [region, setRegion] = useState('');
  const [category, setCategory] = useState('bar');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) {
      // Reset when closed so a second open starts clean
      setName('');
      setIgHandle('');
      setRegion('');
      setCategory('bar');
      setAddress('');
      setNote('');
      setError('');
      setDone(false);
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  async function submit() {
    if (submitting) return;
    setError('');
    if (!name.trim()) return setError('가게명을 입력해주세요.');
    if (!region) return setError('지역을 선택해주세요.');
    setSubmitting(true);
    try {
      const res = await fetch('/api/spot-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          ig_handle: igHandle.trim(),
          region,
          category,
          address: address.trim(),
          note: note.trim(),
          fingerprint: getFingerprint(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || '제출에 실패했습니다.');
      }
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
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
        className="w-full max-w-md bg-white"
        style={{ borderRadius: 16, maxHeight: '90dvh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <h2 className="font-bold" style={{ color: '#111827', fontSize: 16 }}>
            가게 제안하기
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
              제안해 주셔서 감사합니다.
              <br />
              검토 후 등록됩니다.
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
            <Field label="가게명 *">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 감성바 on제주"
                className="w-full"
                style={inputStyle}
              />
            </Field>
            <Field label="인스타그램 계정">
              <input
                value={igHandle}
                onChange={(e) => setIgHandle(e.target.value)}
                placeholder="@ 없이 아이디만"
                className="w-full"
                style={inputStyle}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="지역 *">
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full"
                  style={inputStyle}
                >
                  <option value="">선택</option>
                  {REGIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="종류">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full"
                  style={inputStyle}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="주소">
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="선택 사항"
                className="w-full"
                style={inputStyle}
              />
            </Field>
            <Field label="한줄 메모">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="어떤 가게인지, 뭐가 좋은지 간단히"
                rows={2}
                className="w-full resize-none"
                style={inputStyle}
              />
            </Field>

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
                marginTop: 4,
              }}
            >
              {submitting ? '제출 중…' : '제안 보내기'}
            </button>
            <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>
              검토 후 지도·피드에 반영됩니다.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: '9px 11px',
  fontSize: 13,
  color: '#111827',
  background: '#fff',
  outline: 'none',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: 500 }}>
        {label}
      </div>
      {children}
    </label>
  );
}

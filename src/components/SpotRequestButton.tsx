'use client';

import { useState } from 'react';
import SpotRequestModal from './SpotRequestModal';

interface Props {
  variant?: 'floating' | 'banner' | 'compact';
}

export default function SpotRequestButton({ variant = 'floating' }: Props) {
  const [open, setOpen] = useState(false);

  if (variant === 'compact') {
    // Narrow pill meant to sit at the right edge of the LocationPicker
    // chip row — same height (30px) and font scale as the filter chips
    // so it visually belongs to that row, with a + icon to read as CTA
    // rather than a filter option.
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          aria-label="가게 제안하기"
          className="flex-shrink-0 flex items-center gap-1"
          style={{
            height: 30,
            padding: '0 12px',
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 500,
            color: '#374151',
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          가게제안하기
        </button>
        <SpotRequestModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  if (variant === 'banner') {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between"
          style={{
            background: '#f8f9fa',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            padding: '10px 14px',
            fontSize: 12,
            color: '#374151',
          }}
        >
          <span>여기 없는 가게 있나요?</span>
          <span style={{ color: '#111827', fontWeight: 600 }}>제안하기 →</span>
        </button>
        <SpotRequestModal open={open} onClose={() => setOpen(false)} />
      </>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="가게 제안하기"
        className="fixed flex items-center gap-1.5"
        style={{
          right: 16,
          bottom: 92,
          zIndex: 9998,
          background: '#111827',
          color: '#fff',
          padding: '10px 14px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        가게 제안
      </button>
      <SpotRequestModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

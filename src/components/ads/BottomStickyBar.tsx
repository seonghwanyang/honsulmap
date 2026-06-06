'use client';

import { useEffect, useState } from 'react';
import AdSlot from './AdSlot';
import { AD_TEST_MODE, AD_UNITS } from '@/lib/ads/config';

const STORAGE_KEY = 'ad:bottom:dismissed';
const BOTTOM_NAV_HEIGHT = 56;

export default function BottomStickyBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  function dismiss() {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
  }

  if (!visible) return null;
  // Don't show an empty bar before the AdFit unit ID is configured.
  if (!AD_TEST_MODE && !AD_UNITS.adfitBottom.adfitUnitId) return null;

  return (
    <div
      className="md:hidden fixed left-0 right-0 z-40 flex justify-center px-3"
      style={{ bottom: BOTTOM_NAV_HEIGHT + 8 }}
    >
      <div
        style={{
          position: 'relative',
          borderRadius: 14,
          overflow: 'hidden',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          lineHeight: 0,
        }}
      >
        <button
          onClick={dismiss}
          aria-label="광고 닫기"
          className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center z-10"
          style={{ color: '#9ca3af', fontSize: 14, background: 'rgba(255,255,255,0.85)' }}
        >
          ×
        </button>
        <AdSlot unit="adfitBottom" />
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import AdSlot from './AdSlot';

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

  return (
    <div
      className="md:hidden fixed left-0 right-0 z-40 flex items-center justify-center"
      style={{
        bottom: BOTTOM_NAV_HEIGHT,
        background: '#ffffff',
        borderTop: '1px solid #f3f4f6',
        padding: '4px 0',
      }}
    >
      <button
        onClick={dismiss}
        aria-label="광고 닫기"
        className="absolute top-1 right-2 w-5 h-5 rounded-full flex items-center justify-center"
        style={{ color: '#9ca3af', fontSize: 14 }}
      >
        ×
      </button>
      <AdSlot unit="banner320x50" />
    </div>
  );
}

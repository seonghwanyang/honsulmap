'use client';

import { useEffect, useState } from 'react';
import AdSlot from './AdSlot';
import { AD_TEST_MODE, AD_UNITS } from '@/lib/ads/config';

const BOTTOM_NAV_HEIGHT = 56;

// Floating ad card above the bottom nav. No close button — AdFit disallows a
// click-inducing button on the ad ("광고 닫기 버튼 삭제") — and a clear gap from
// the nav so it isn't flagged as adjacent to the main function buttons.
export default function BottomStickyBar() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (!AD_TEST_MODE && !AD_UNITS.adfitBottom.adfitUnitId) return null;

  // Plain ad — no rounding/clipping (AdFit policy). The full ad must show.
  return (
    <div
      className="fixed left-0 right-0 z-40 flex justify-center"
      style={{ bottom: BOTTOM_NAV_HEIGHT + 18, lineHeight: 0 }}
    >
      <AdSlot unit="adfitBottom" />
    </div>
  );
}

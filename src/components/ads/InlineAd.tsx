'use client';

import AdSlot from './AdSlot';
import { AD_TEST_MODE, AD_UNITS } from '@/lib/ads/config';

// In-content ad (300x250), rounded card to match the rest of the UI. Renders
// nothing until the AdFit inline unit ID is configured, so it's safe to ship
// the placement before the DAN-id exists. No close button, sits in the
// content flow away from the nav — satisfies AdFit's review notes.
export default function InlineAd() {
  if (!AD_TEST_MODE && !AD_UNITS.adfitInline.adfitUnitId) return null;

  return (
    <div className="flex justify-center my-1">
      <div
        style={{
          borderRadius: 14,
          overflow: 'hidden',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
          lineHeight: 0,
        }}
      >
        <AdSlot unit="adfitInline" />
      </div>
    </div>
  );
}

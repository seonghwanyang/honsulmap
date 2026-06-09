'use client';

import AdSlot from './AdSlot';
import { AD_TEST_MODE, AD_UNITS } from '@/lib/ads/config';

// In-content ad (300x250), rounded card to match the rest of the UI. Renders
// nothing until the AdFit inline unit ID is configured, so it's safe to ship
// the placement before the DAN-id exists. No close button, sits in the
// content flow away from the nav — satisfies AdFit's review notes.
export default function InlineAd({
  unit = 'adfitInline',
}: {
  unit?: keyof typeof AD_UNITS;
}) {
  if (!AD_TEST_MODE && !AD_UNITS[unit].adfitUnitId) return null;

  // Full-width card (matches the story cards' width) with the fixed-size ad
  // centered inside, so the box lines up with the rest of the UI.
  return (
    <div
      className="my-1 w-full flex items-center justify-center"
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        padding: '14px 0',
      }}
    >
      <AdSlot unit={unit} />
    </div>
  );
}

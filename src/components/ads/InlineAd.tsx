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

  // Plain centered ad — no border-radius/overflow/border/shadow. AdFit
  // disallows clipping or "emphasizing" the ad; the full ad area must show.
  return (
    <div className="my-3 w-full flex justify-center">
      <AdSlot unit={unit} />
    </div>
  );
}

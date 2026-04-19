'use client';

import AdSlot from './AdSlot';

export default function NativeHorizontal() {
  return (
    <div className="my-4 flex items-center justify-center">
      {/* Mobile: 320x50 | Tablet: 468x60 | Desktop: 728x90 */}
      <div className="block md:hidden">
        <AdSlot unit="banner320x50" />
      </div>
      <div className="hidden md:block lg:hidden">
        <AdSlot unit="banner468x60" />
      </div>
      <div className="hidden lg:block">
        <AdSlot unit="banner728x90" />
      </div>
    </div>
  );
}

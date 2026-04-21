'use client';

import AdSlot from './AdSlot';

interface SideBannerProps {
  position: 'left' | 'right';
}

export default function SideBanner({ position }: SideBannerProps) {
  // The app body is max-w-screen-md (768px) centered. Side banners sit in
  // the outer viewport margins on desktop only.
  //
  // xl (≥1440): both sides, 160x600
  // lg (1024~1439): right side only, 160x600 or 160x300
  // < lg: hidden (mobile gets bottom sticky bar instead)
  const base = 'hidden lg:block fixed top-24 z-30';
  const sideClass =
    position === 'left'
      ? 'left-[calc(50%-544px)] xl:left-[calc(50%-624px)]'
      : 'right-[calc(50%-544px)] xl:right-[calc(50%-624px)]';

  const visibility = position === 'left' ? 'hidden xl:block' : '';

  return (
    <aside className={`${base} ${sideClass} ${visibility}`}>
      <AdSlot unit="banner160x600" />
    </aside>
  );
}

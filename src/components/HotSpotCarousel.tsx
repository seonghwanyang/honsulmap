'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { relativeTime, getRegionLabel } from '@/lib/utils';
import type { Region } from '@/lib/types';

interface HotSpot {
  slug: string;
  name: string;
  region: Region | null;
  naver_photo: string | null;
  latest_story_at: string | null;
}

// Floating dark pill (NOT edge-to-edge) above the map showing spots
// that posted a fresh IG story in the last 24h. The strip auto-scrolls
// leftward so the band feels alive ("실시간 근황"). Touching the strip
// pauses the animation so the user can read + tap a specific card.
//
// Visual reference: ref/5.jpg — but using our brand palette
// (#111827 dark pill, #1f2937 inner card chips, #ea573e accent flame),
// not the beige/orange of the reference.
export default function HotSpotCarousel() {
  const router = useRouter();
  const [spots, setSpots] = useState<HotSpot[] | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/spots/carousel');
        if (!res.ok) {
          if (!cancelled) setSpots([]);
          return;
        }
        const data = (await res.json()) as HotSpot[];
        if (!cancelled) setSpots(data);
      } catch {
        if (!cancelled) setSpots([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Loading: keep the band's height so the LocationPicker below doesn't
  // jump up when data resolves. Match the final pill shape too.
  if (spots === null) {
    return (
      <div className="px-3 pt-1 pb-2">
        <div
          style={{
            background: '#fff',
            height: 52,
            borderRadius: 16,
            border: '1px solid #e5e7eb',
            boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
          }}
          aria-hidden="true"
        />
      </div>
    );
  }

  // Confirmed empty — collapse the band so the map gets the space back.
  if (spots.length === 0) return null;

  // Only run the marquee when there are enough chips that motion buys
  // us something. With ≤3 chips everything fits, and a moving target
  // would just make taps harder for no payoff.
  const shouldMarquee = spots.length > 3;
  const items = shouldMarquee ? [...spots, ...spots] : spots;

  return (
    <div className="px-3 pt-1 pb-2">
      <div
        className="flex items-center gap-2 overflow-hidden"
        style={{
          background: '#fff',
          color: '#111827',
          borderRadius: 16,
          height: 52,
          paddingLeft: 12,
          paddingRight: 8,
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
        }}
      >
        {/* Left label */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="#ea573e"
            aria-hidden="true"
          >
            <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14a8 8 0 0 0 16 0C20 9.9 18.04 6.24 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" />
          </svg>
          <span className="text-[11px] font-semibold tracking-[-0.1px] whitespace-nowrap">
            실시간 근황
          </span>
        </div>

        {/* Marquee viewport — pauses on touch so the moving chips stop
            while the user is trying to read or tap one. When chip count
            is small enough to fit, falls back to plain horizontal swipe
            with no animation. */}
        <div
          className={`flex-1 min-w-0 ${shouldMarquee ? 'overflow-hidden' : 'overflow-x-auto hide-scrollbar'}`}
          onPointerDown={shouldMarquee ? () => setPaused(true) : undefined}
          onPointerUp={shouldMarquee ? () => setPaused(false) : undefined}
          onPointerLeave={shouldMarquee ? () => setPaused(false) : undefined}
          onPointerCancel={shouldMarquee ? () => setPaused(false) : undefined}
        >
          <div
            className="flex gap-2"
            style={{
              width: shouldMarquee ? 'max-content' : undefined,
              animation: shouldMarquee
                ? 'carousel-scroll 30s linear infinite'
                : undefined,
              animationPlayState: paused ? 'paused' : 'running',
            }}
          >
            {items.map((spot, i) => (
              <button
                key={`${spot.slug}-${i}`}
                onClick={() => router.push(`/?spot=${spot.slug}`)}
                aria-label={`${spot.name} 상세보기`}
                className="flex items-center gap-2 flex-shrink-0"
                style={{
                  background: '#f3f4f6',
                  borderRadius: 999,
                  padding: '3px 12px 3px 3px',
                  border: 'none',
                }}
              >
                <SpotThumb photo={spot.naver_photo} name={spot.name} />
                {/* Name on top, time underneath. Top-anchored against
                    the photo (not vertically centered) so the chip feels
                    informational rather than centered text. */}
                <span
                  className="flex flex-col items-start min-w-0 max-w-[110px]"
                  style={{ paddingTop: 1, lineHeight: 1.15 }}
                >
                  <span className="text-[12px] font-semibold truncate w-full text-left" style={{ color: '#111827' }}>
                    {spot.name}
                  </span>
                  {spot.latest_story_at && (
                    <span className="text-[10px] truncate w-full text-left" style={{ color: '#6b7280' }}>
                      {relativeTime(spot.latest_story_at)}
                      {spot.region ? ` (${getRegionLabel(spot.region)})` : ''}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Right chevron — hint that the row scrolls */}
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.7, flexShrink: 0 }}
          aria-hidden="true"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
      <style>{
        '@keyframes carousel-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}'
      }</style>
    </div>
  );
}

function SpotThumb({ photo, name }: { photo: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  if (photo && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={name}
        className="object-cover"
        style={{ width: 32, height: 32, borderRadius: 999, flexShrink: 0 }}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center"
      style={{
        width: 32,
        height: 32,
        borderRadius: 999,
        background: '#e5e7eb',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    </div>
  );
}

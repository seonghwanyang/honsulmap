'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { relativeTime } from '@/lib/utils';

interface HotSpot {
  slug: string;
  name: string;
  naver_photo: string | null;
  latest_story_at: string | null;
}

// Dark strip showing spots that posted a new story in the last 24h.
// Visual tone: matches our brand (#111827 dark + #ea573e accent + white
// text) rather than ref/5.jpg's beige/orange. Hidden entirely when there
// are no fresh spots so it doesn't leave an empty band on the map.
export default function HotSpotCarousel() {
  const router = useRouter();
  const [spots, setSpots] = useState<HotSpot[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/spots/carousel');
        if (!res.ok) return;
        const data = (await res.json()) as HotSpot[];
        if (!cancelled) setSpots(data);
      } catch {
        // Silent — the carousel is optional decoration.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!spots || spots.length === 0) return null;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2"
      style={{ background: '#111827', color: '#fff' }}
    >
      {/* Left label */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="#ea573e"
          aria-hidden="true"
        >
          <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14a8 8 0 0 0 16 0C20 9.9 18.04 6.24 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" />
        </svg>
        <span className="text-[12px] font-semibold tracking-[-0.1px]">
          지금 핫
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 min-w-0 flex gap-2 overflow-x-auto hide-scrollbar">
        {spots.map((spot) => (
          <button
            key={spot.slug}
            onClick={() => router.push(`/?spot=${spot.slug}`)}
            className="flex items-center gap-2 flex-shrink-0 px-2 py-1"
            style={{
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <SpotThumb photo={spot.naver_photo} />
            <div className="flex flex-col items-start min-w-0 max-w-[120px]">
              <span className="text-[12px] font-semibold truncate w-full text-left">
                {spot.name}
              </span>
              <span className="text-[10px]" style={{ color: '#9ca3af' }}>
                {spot.latest_story_at ? relativeTime(spot.latest_story_at) : ''}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Right chevron — hint that the row scrolls */}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0.4, flexShrink: 0 }}
        aria-hidden="true"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  );
}

function SpotThumb({ photo }: { photo: string | null }) {
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt=""
        className="object-cover"
        style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }}
        loading="lazy"
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center"
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        background: 'rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    </div>
  );
}

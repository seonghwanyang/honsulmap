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
// text) — never the beige/orange of the reference Naver overlay.
//
// While the API is in flight we render a skeleton band of the same
// height so the LocationPicker below doesn't jump up and down when the
// data arrives. Only once we know the list is empty do we hide the
// component entirely.
export default function HotSpotCarousel() {
  const router = useRouter();
  const [spots, setSpots] = useState<HotSpot[] | null>(null);

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

  // Loading: keep the strip's height so layout doesn't shift when data
  // resolves. Same dark background, no content.
  if (spots === null) {
    return (
      <div
        style={{ background: '#111827', height: 60 }}
        aria-hidden="true"
      />
    );
  }

  // Confirmed empty — collapse the band so the map gets the space back.
  if (spots.length === 0) return null;

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
      <div className="flex-1 min-w-0 flex gap-3 overflow-x-auto hide-scrollbar">
        {spots.map((spot) => (
          <button
            key={spot.slug}
            onClick={() => router.push(`/?spot=${spot.slug}`)}
            aria-label={`${spot.name} 상세보기`}
            className="flex items-center gap-2 flex-shrink-0 px-2 py-2"
            style={{
              background: '#1f2937',
              borderRadius: 10,
              border: 'none',
            }}
          >
            <SpotThumb photo={spot.naver_photo} name={spot.name} />
            <div className="flex flex-col items-start min-w-0 max-w-[120px]">
              <span className="text-[12px] font-semibold truncate w-full text-left">
                {spot.name}
              </span>
              <span className="text-[11px]" style={{ color: '#9ca3af' }}>
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
        style={{ opacity: 0.7, flexShrink: 0 }}
        aria-hidden="true"
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  );
}

function SpotThumb({ photo, name }: { photo: string | null; name: string }) {
  // Naver photo URLs occasionally 404 or block hotlinking. `failed`
  // flips to the placeholder so the carousel never shows a broken-image
  // icon.
  const [failed, setFailed] = useState(false);

  if (photo && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photo}
        alt={name}
        className="object-cover"
        style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center"
      style={{
        width: 36,
        height: 36,
        borderRadius: 10,
        background: 'rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
        <circle cx="12" cy="10" r="3" />
      </svg>
    </div>
  );
}

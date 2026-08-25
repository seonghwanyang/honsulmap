'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { relativeTime, getRegionLabel } from '@/lib/utils';
import { CITIES, type Region, type City } from '@/lib/types';

interface HotSpot {
  slug: string;
  name: string;
  region: Region | null;
  naver_photo: string | null;
  latest_story_at: string | null;
}

type CityFilter = 'all' | City;
// Cities show up automatically as they're added to the CITIES vocab.
const CITY_OPTIONS: CityFilter[] = ['all', ...CITIES.map((c) => c.value)];
const CITY_LABELS = Object.fromEntries([
  ['all', '전체'],
  ...CITIES.map((c) => [c.value, c.label] as const),
]) as Record<CityFilter, string>;

function isCityFilter(v: unknown): v is CityFilter {
  return v === 'all' || CITIES.some((c) => c.value === v);
}

// localStorage key shared with handleGps so granting location permission
// pre-selects the user's city for this carousel (we never silently
// filter the global map — only this strip).
const CITY_STORAGE_KEY = 'honsulmap_carousel_city';

function readCity(): CityFilter {
  if (typeof window === 'undefined') return 'all';
  try {
    const raw = localStorage.getItem(CITY_STORAGE_KEY);
    if (isCityFilter(raw)) return raw;
  } catch {
    // ignore
  }
  return 'all';
}

// Light floating pill above the map showing spots that posted a fresh
// IG story in the last 24h. The user can scope to one city via the
// 실시간 근황 ▾ dropdown — defaults to whatever was inferred from GPS
// (handleGps writes the same localStorage key) or '전체' otherwise.
export default function HotSpotCarousel() {
  const router = useRouter();
  const [city, setCity] = useState<CityFilter>('all');
  const [spots, setSpots] = useState<HotSpot[] | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLButtonElement>(null);

  // Read initial city from localStorage on mount + listen for handleGps
  // writes so the carousel updates if the user grants location later.
  // 'storage' event covers cross-tab updates; the custom event covers
  // same-tab writes (MapClient's handleGps fires it after inferring
  // the city from GPS coords).
  useEffect(() => {
    setCity(readCity());
    const onStorage = (e: StorageEvent) => {
      if (e.key === CITY_STORAGE_KEY) setCity(readCity());
    };
    const onCustom = (e: Event) => {
      // Two payload shapes — bare string (legacy) and { city, source }
      // (current). Accept both so older callers keep working.
      const raw = (e as CustomEvent).detail;
      const v: unknown =
        raw && typeof raw === 'object' && 'city' in raw
          ? (raw as { city: unknown }).city
          : raw;
      if (isCityFilter(v)) setCity(v);
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('honsulmap:carousel-city', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('honsulmap:carousel-city', onCustom);
    };
  }, []);

  // Fetch spots whenever the selected city changes. Server-side caches
  // each city payload independently (s-maxage=60).
  useEffect(() => {
    let cancelled = false;
    setSpots(null);
    (async () => {
      try {
        const url =
          city === 'all'
            ? '/api/spots/carousel'
            : `/api/spots/carousel?city=${city}`;
        const res = await fetch(url);
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
  }, [city]);

  // Close the dropdown when clicking outside its trigger.
  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (labelRef.current && !labelRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const pickCity = (next: CityFilter) => {
    setCity(next);
    setMenuOpen(false);
    try {
      localStorage.setItem(CITY_STORAGE_KEY, next);
    } catch {
      // ignore — selection still applies for this session.
    }
    // Let MapClient know the user explicitly picked this city so it
    // can pan the map. Source-tagged so a GPS-inferred event doesn't
    // double-pan over the user's actual position.
    window.dispatchEvent(
      new CustomEvent('honsulmap:carousel-city', {
        detail: { city: next, source: 'user' },
      }),
    );
  };

  // Scroll the cards container right by roughly one card width when
  // the user taps the right chevron. Smooth so the motion reads as
  // "more this way" rather than a jolt.
  const scrollRight = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: Math.min(220, el.clientWidth * 0.7), behavior: 'smooth' });
  };

  // Pause state for the auto-scroll: true while the pointer is over
  // the strip (desktop hover) or held down on it (mobile touch).
  const [paused, setPaused] = useState(false);

  // Auto-scroll loop. Drives scrollLeft via rAF instead of a CSS
  // marquee so finger-swipe and the rAF loop share the same axis. The
  // loop only runs when the content actually overflows the strip; if
  // every chip already fits there's nowhere to scroll to.
  useEffect(() => {
    if (paused) return;
    if (!spots || spots.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollWidth <= el.clientWidth + 1) return; // nothing to scroll
    let raf = 0;
    const tick = () => {
      const node = scrollRef.current;
      if (!node) return;
      // ~1.2px / frame ≈ 70px/sec — slow enough to read, fast enough
      // to register as motion.
      node.scrollLeft += 1.2;
      const half = node.scrollWidth / 2;
      if (node.scrollLeft >= half) node.scrollLeft -= half;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, spots]);

  // Loading: keep the band's height so the LocationPicker below doesn't
  // jump up when data resolves.
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

  return (
    <div className="px-3 pt-1 pb-2">
      <div
        className="flex items-center gap-2"
        style={{
          background: '#fff',
          color: '#111827',
          borderRadius: 16,
          height: 52,
          paddingLeft: 12,
          paddingRight: 4,
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
          position: 'relative',
        }}
      >
        {/* City dropdown trigger */}
        <button
          ref={labelRef}
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-1.5 flex-shrink-0"
          style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer' }}
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#ea573e" aria-hidden="true">
            <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14a8 8 0 0 0 16 0C20 9.9 18.04 6.24 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z" />
          </svg>
          <span className="text-[11px] font-semibold tracking-[-0.1px] whitespace-nowrap">
            실시간 근황
            {city !== 'all' && (
              <span style={{ color: '#6b7280', marginLeft: 4 }}>
                {CITY_LABELS[city]}
              </span>
            )}
          </span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: menuOpen ? 'rotate(180deg)' : 'rotate(0)',
              transition: 'transform 180ms ease',
              opacity: 0.7,
            }}
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>

          {menuOpen && (
            <ul
              role="listbox"
              className="absolute"
              style={{
                top: 'calc(100% + 4px)',
                left: 8,
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                boxShadow: '0 6px 18px rgba(0,0,0,0.10)',
                padding: 4,
                zIndex: 50,
                minWidth: 120,
                maxHeight: '50vh',
                overflowY: 'auto',
              }}
            >
              {CITY_OPTIONS.map((opt) => {
                const active = opt === city;
                return (
                  <li
                    key={opt}
                    role="option"
                    aria-selected={active}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pickCity(opt);
                    }}
                    className="text-[12px]"
                    style={{
                      padding: '8px 12px',
                      borderRadius: 8,
                      fontWeight: active ? 600 : 400,
                      color: active ? '#111827' : '#374151',
                      background: active ? '#f3f4f6' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {CITY_LABELS[opt]}
                  </li>
                );
              })}
            </ul>
          )}
        </button>

        {/* Cards — auto-scroll + finger swipe + ▶ button all driving the
            same scrollLeft. Hover/touch pauses the auto-scroll so users
            can read or tap a chip. */}
        <div
          ref={scrollRef}
          className="flex-1 min-w-0 overflow-x-auto hide-scrollbar"
          // Pause only on touch/drag — no mouseenter pause, otherwise a
          // user whose cursor happens to be over the strip never sees
          // the auto-scroll at all.
          onPointerDown={() => setPaused(true)}
          onPointerUp={() => setPaused(false)}
          onPointerCancel={() => setPaused(false)}
        >
          {spots.length === 0 ? (
            <span className="text-[11px]" style={{ color: '#9ca3af' }}>
              아직 올라온 현황이 없어요
            </span>
          ) : (
            // Double the list when there's enough to loop so the
            // rAF wrap (scrollLeft -= half) lands on identical content
            // — no visible jump.
            <div className="flex gap-2">
              {(spots.length >= 2 ? [...spots, ...spots] : spots).map((spot, i) => (
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
          )}
        </div>

        {/* Scroll-right button — gives keyboard / non-swipe users a way
            to advance the carousel. Hidden when nothing is overflowing. */}
        {spots.length > 1 && (
          <button
            type="button"
            onClick={scrollRight}
            aria-label="오른쪽으로 스크롤"
            className="flex-shrink-0 flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: '#f3f4f6',
              border: 'none',
              cursor: 'pointer',
              color: '#6b7280',
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        )}
      </div>
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

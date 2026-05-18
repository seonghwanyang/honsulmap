'use client';

import { City, Region, CITIES, REGIONS } from '@/lib/types';

interface LocationPickerProps {
  city: City | null;
  region: Region | null;
  onChange: (city: City | null, region: Region | null) => void;
}

// Two inline chip rows. Row 1 is always visible (전체 / 제주 / 서울).
// Row 2 (구) appears only when a city is selected. No modal/sheet, no
// portal — the map stays in view the entire time. Selections take one
// tap each: tap a city for that city, then optionally tap a 구 to
// narrow further.
export default function LocationPicker({ city, region, onChange }: LocationPickerProps) {
  const regionOptions = REGIONS.filter(
    (r) => r.value !== 'all' && r.city === city,
  );

  return (
    <div>
      {/* Row 1 — 도시 (always shown) */}
      <div
        className="flex overflow-x-auto hide-scrollbar gap-[7px] px-4"
        style={{ paddingTop: 9, paddingBottom: city ? 4 : 9 }}
      >
        <Chip
          active={city === null}
          onClick={() => onChange(null, null)}
        >
          전체
        </Chip>
        {CITIES.map((c) => (
          <Chip
            key={c.value}
            active={city === c.value}
            // The ▾ hints that picking this chip reveals more options
            // (the 구 row underneath). Rotates to ▴ when expanded so
            // it's clear what the chevron is referring to.
            expandable
            expanded={city === c.value}
            onClick={() => onChange(c.value, null)}
          >
            {c.label}
          </Chip>
        ))}
      </div>

      {/* Row 2 — 구 (city selected). Collapses with a height transition
          so the map doesn't jump when filters change. */}
      <div
        style={{
          maxHeight: city ? '44px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 220ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <div
          className="flex overflow-x-auto hide-scrollbar gap-[6px] px-4"
          style={{ paddingTop: 4, paddingBottom: 9 }}
        >
          <Chip
            subtle
            active={region === null && city !== null}
            onClick={() => city && onChange(city, null)}
          >
            전체
          </Chip>
          {regionOptions.map((r) => (
            <Chip
              key={r.value}
              subtle
              active={region === r.value}
              onClick={() => city && onChange(city, r.value as Region)}
            >
              {r.label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

function Chip({
  active,
  subtle,
  expandable,
  expanded,
  onClick,
  children,
}: {
  active: boolean;
  subtle?: boolean;
  expandable?: boolean;
  expanded?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 rounded-full cursor-pointer"
      style={{
        height: subtle ? 26 : 30,
        padding: subtle ? '0 11px' : expandable ? '0 10px 0 14px' : '0 14px',
        fontSize: subtle ? 12 : 13,
        fontWeight: active ? 600 : 400,
        letterSpacing: '-0.1px',
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        background: active ? '#111827' : '#fff',
        color: active ? '#fff' : subtle ? '#9ca3af' : '#6b7280',
        border: active
          ? '1px solid #111827'
          : `1px solid ${subtle ? '#f3f4f6' : '#e5e7eb'}`,
        transition: 'background-color 120ms ease, color 120ms ease, border-color 120ms ease',
        display: 'inline-flex',
        alignItems: 'center',
        gap: expandable ? 4 : 0,
      }}
    >
      {children}
      {expandable && (
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
            transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 180ms ease',
            opacity: 0.85,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      )}
    </button>
  );
}

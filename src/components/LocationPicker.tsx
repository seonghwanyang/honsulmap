'use client';

import { useEffect, useRef, useState } from 'react';
import { City, Region, CITIES, REGIONS } from '@/lib/types';

interface LocationPickerProps {
  city: City | null;
  region: Region | null;
  // GPS/IP-inferred home city. Used ONLY to pre-open that city's 세부지역
  // row when nothing is explicitly selected (전체) — never auto-filters.
  homeCity?: City | null;
  onChange: (city: City | null, region: Region | null) => void;
}

// Jeju's two "compass" regions read as bare 동쪽/서쪽 globally; spell them
// out a touch inside the picker.
const REGION_LABEL_OVERRIDES: Partial<Record<Region, string>> = {
  east: '동부',
  west: '서부',
};

function cityLabel(c: City): string {
  return CITIES.find((x) => x.value === c)?.label ?? c;
}
function regionLabel(r: Region): string {
  return (
    REGION_LABEL_OVERRIDES[r] ??
    REGIONS.find((x) => x.value === r)?.label ??
    r
  );
}

// One compact "📍 지역" pill that opens a two-tier popover: 도시 (1차) on
// top, the selected/home city's 세부지역 (2차) underneath — same drill-down
// feel as the category picker. Collapsing the old always-on chip row frees
// the filter bar so the 가게 제안하기 button no longer crowds it, and it
// scales as more cities are added.
export default function LocationPicker({
  city,
  region,
  homeCity,
  onChange,
}: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Which city's 세부지역 to show. An explicit city filter wins; otherwise
  // fall back to the GPS/IP home city so e.g. a 부산 visitor opens straight
  // to 부산 구 even while the map stays on 전체.
  const expandedCity: City | null = city ?? homeCity ?? null;
  const regionOptions = expandedCity
    ? REGIONS.filter((r) => r.value !== 'all' && r.city === expandedCity)
    : [];

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const triggerLabel =
    city == null
      ? '전체'
      : region
        ? `${cityLabel(city)} · ${regionLabel(region)}`
        : cityLabel(city);
  const activeFilter = city != null;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }} className="px-4 py-[9px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="rounded-full cursor-pointer"
        style={{
          height: 30,
          padding: '0 9px 0 11px',
          fontSize: 13,
          fontWeight: activeFilter ? 600 : 500,
          letterSpacing: '-0.1px',
          lineHeight: 1.4,
          whiteSpace: 'nowrap',
          maxWidth: '70vw',
          background: activeFilter ? '#111827' : '#fff',
          color: activeFilter ? '#fff' : '#374151',
          border: `1px solid ${activeFilter ? '#111827' : '#e5e7eb'}`,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.9, flexShrink: 0 }}
          aria-hidden="true"
        >
          <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {triggerLabel}
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
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 180ms ease',
            opacity: 0.7,
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute"
          style={{
            top: 'calc(100% + 4px)',
            left: 12,
            background: '#fff',
            borderRadius: 14,
            border: '1px solid #e5e7eb',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: '10px 0 12px',
            zIndex: 60,
            width: 'min(92vw, 360px)',
            maxHeight: '60vh',
            overflowY: 'auto',
          }}
        >
          {/* 1차 — 도시 */}
          <SectionLabel>도시</SectionLabel>
          <div className="flex flex-wrap gap-[6px] px-3">
            <Chip
              active={city == null}
              onClick={() => {
                onChange(null, null);
                setOpen(false);
              }}
            >
              전체
            </Chip>
            {CITIES.map((c) => (
              <Chip
                key={c.value}
                active={city === c.value}
                // Tap a city → filter to it, keep the popover open so the
                // 세부지역 row swaps in for an optional second tap.
                onClick={() => onChange(c.value, null)}
              >
                {c.label}
              </Chip>
            ))}
          </div>

          {/* 2차 — 세부지역 (expandedCity) */}
          {regionOptions.length > 0 && (
            <>
              <SectionLabel style={{ marginTop: 10 }}>
                {cityLabel(expandedCity as City)} 세부지역
              </SectionLabel>
              <div className="flex flex-wrap gap-[6px] px-3">
                <Chip
                  subtle
                  active={city === expandedCity && region == null}
                  onClick={() => {
                    onChange(expandedCity as City, null);
                    setOpen(false);
                  }}
                >
                  전체
                </Chip>
                {regionOptions.map((r) => (
                  <Chip
                    key={r.value}
                    subtle
                    active={region === r.value}
                    onClick={() => {
                      onChange(expandedCity as City, r.value as Region);
                      setOpen(false);
                    }}
                  >
                    {REGION_LABEL_OVERRIDES[r.value as Region] ?? r.label}
                  </Chip>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SectionLabel({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="px-3"
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: '#9ca3af',
        marginBottom: 6,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Chip({
  active,
  subtle,
  onClick,
  children,
}: {
  active: boolean;
  subtle?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-shrink-0 rounded-full cursor-pointer"
      style={{
        height: subtle ? 28 : 30,
        padding: subtle ? '0 12px' : '0 13px',
        fontSize: subtle ? 12 : 13,
        fontWeight: active ? 600 : 400,
        letterSpacing: '-0.1px',
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        background: active ? '#111827' : '#fff',
        color: active ? '#fff' : subtle ? '#6b7280' : '#374151',
        border: `1px solid ${active ? '#111827' : subtle ? '#f3f4f6' : '#e5e7eb'}`,
        transition: 'background-color 120ms ease, color 120ms ease, border-color 120ms ease',
      }}
    >
      {children}
    </button>
  );
}

'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { City, Region, CITIES, REGIONS } from '@/lib/types';

interface LocationPickerProps {
  city: City | null;
  region: Region | null;
  onChange: (city: City | null, region: Region | null) => void;
}

function getButtonLabel(city: City | null, region: Region | null): string {
  if (!city) return '전체';
  const cityLabel = CITIES.find((c) => c.value === city)?.label ?? city;
  if (!region) return cityLabel;
  const regionLabel = REGIONS.find((r) => r.value === region)?.label ?? region;
  return `${cityLabel} · ${regionLabel}`;
}

export default function LocationPicker({ city, region, onChange }: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  // 'entering' | 'open' | 'closing' drives slide/fade animation.
  const [phase, setPhase] = useState<'entering' | 'open' | 'closing'>('entering');
  // Internal city cursor while the sheet is open — does not commit until a
  // region row is tapped or the city row is tapped a second time.
  const [draftCity, setDraftCity] = useState<City | null>(city);
  const rightColRef = useRef<HTMLDivElement | null>(null);

  // Sync draft when props change (e.g. URL-driven initial state)
  useEffect(() => {
    setDraftCity(city);
  }, [city]);

  // Kick the enter animation on next frame so the initial state actually paints.
  useEffect(() => {
    if (!open) return;
    setPhase('entering');
    const id = requestAnimationFrame(() => setPhase('open'));
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Reset right-column scroll when switching cities — feels like a fresh page.
  useEffect(() => {
    if (rightColRef.current) rightColRef.current.scrollTop = 0;
  }, [draftCity]);

  const regionOptions = REGIONS.filter(
    (r) => r.value !== 'all' && r.city === draftCity,
  );

  const handleOpen = () => {
    setDraftCity(city);
    setOpen(true);
  };

  const handleClose = () => {
    setPhase('closing');
    // Match the CSS transition duration below.
    window.setTimeout(() => setOpen(false), 200);
  };

  // Left column: 전체 / 제주 / 서울
  const handleCityClick = (c: City | null) => {
    if (c === null) {
      onChange(null, null);
      handleClose();
      return;
    }
    if (draftCity === c) {
      // Tapping the already-highlighted city confirms city-only selection
      onChange(c, null);
      handleClose();
      return;
    }
    setDraftCity(c);
  };

  // Right column: 전체 (도시 전체) row or a specific region
  const handleRegionClick = (r: Region | null) => {
    if (r === null) {
      onChange(draftCity, null);
    } else {
      onChange(draftCity, r);
    }
    handleClose();
  };

  const label = getButtonLabel(city, region);
  const hasSelection = city !== null;

  // Backdrop and sheet opacity/translate states for the animation.
  const backdropOpacity = phase === 'open' ? 1 : 0;
  const sheetEnter = phase === 'open';

  return (
    <>
      {/* Trigger button — sits in the same horizontal row the old
          RegionFilter occupied. */}
      <div style={{ padding: '9px 16px', display: 'flex' }}>
        <button
          onClick={handleOpen}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            height: '30px',
            padding: '0 12px',
            borderRadius: '999px',
            border: hasSelection ? '1px solid #111827' : '1px solid #e5e7eb',
            background: hasSelection ? '#111827' : '#fff',
            color: hasSelection ? '#fff' : '#6b7280',
            fontSize: '13px',
            fontWeight: hasSelection ? 600 : 400,
            letterSpacing: '-0.1px',
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            lineHeight: 1.4,
            transition: 'box-shadow 160ms ease',
            boxShadow: hasSelection ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
          <span>{label}</span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginLeft: '1px', opacity: 0.6 }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {/* Backdrop + sheet are rendered into <body> so the z-20 filter row
          they live under doesn't trap them in a stacking context. */}
      {open && typeof document !== 'undefined' && createPortal(
        <>
          <div
            onClick={handleClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 40,
              background: 'rgba(17,24,39,0.42)',
              opacity: backdropOpacity,
              transition: 'opacity 200ms ease',
            }}
          />

          <div
            className="location-picker-panel"
            data-phase={phase}
            style={{
              position: 'fixed',
              zIndex: 41,
              background: '#fff',
              bottom: 0,
              left: 0,
              right: 0,
              borderRadius: '16px 16px 0 0',
              boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
              // Mobile slide-up
              transform: sheetEnter ? 'translateY(0)' : 'translateY(100%)',
              transition: 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1)',
              willChange: 'transform',
            }}
          >
            {/* Drag handle — iOS sheet convention */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '8px' }} className="location-picker-handle">
              <div
                style={{
                  width: '36px',
                  height: '4px',
                  borderRadius: '999px',
                  background: '#d1d5db',
                }}
              />
            </div>

            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px 12px',
                borderBottom: '1px solid #f3f4f6',
              }}
            >
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#111827', letterSpacing: '-0.2px' }}>
                지역 선택
              </span>
              <button
                onClick={handleClose}
                style={{
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#9ca3af',
                  margin: '-4px -4px -4px 0',
                }}
                aria-label="닫기"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Two-column body */}
            <div style={{ display: 'flex', height: '320px' }} className="location-picker-body">
              {/* Left: city rail */}
              <div
                style={{
                  width: '104px',
                  flexShrink: 0,
                  background: '#fafafa',
                  borderRight: '1px solid #f3f4f6',
                  overflowY: 'auto',
                  paddingTop: '4px',
                  paddingBottom: '4px',
                }}
              >
                <CityRow
                  label="전체"
                  active={city === null}
                  onClick={() => handleCityClick(null)}
                />
                {CITIES.map((c) => (
                  <CityRow
                    key={c.value}
                    label={c.label}
                    active={draftCity === c.value}
                    onClick={() => handleCityClick(c.value)}
                  />
                ))}
              </div>

              {/* Right: region list */}
              <div ref={rightColRef} style={{ flex: 1, overflowY: 'auto' }}>
                {draftCity === null ? (
                  <EmptyHint />
                ) : (
                  <>
                    {/* Sticky subheader so user always knows the active city */}
                    <div
                      style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                        background: 'rgba(255,255,255,0.96)',
                        backdropFilter: 'blur(6px)',
                        padding: '10px 16px 8px',
                        borderBottom: '1px solid #f3f4f6',
                        display: 'flex',
                        alignItems: 'baseline',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', letterSpacing: '0.2px', textTransform: 'uppercase' }}>
                        {CITIES.find((c) => c.value === draftCity)?.label}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 500, color: '#9ca3af', letterSpacing: '-0.1px' }}>
                        {regionOptions.length}개 지역
                      </span>
                    </div>

                    {/* Region grid — 2 cols on desktop for Seoul, 1 col elsewhere */}
                    <div className="location-picker-regions">
                      {/* 전체 (도시 전체) row — always full-width */}
                      <button
                        onClick={() => handleRegionClick(null)}
                        className="location-picker-region-all"
                        style={{
                          width: '100%',
                          minHeight: '44px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0 16px',
                          fontSize: '14px',
                          fontWeight: region === null && city === draftCity ? 600 : 500,
                          color: region === null && city === draftCity ? '#111827' : '#374151',
                          background: region === null && city === draftCity ? '#f8f9fa' : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f3f4f6',
                          letterSpacing: '-0.2px',
                          transition: 'background 120ms ease',
                        }}
                      >
                        <span>{CITIES.find((c) => c.value === draftCity)?.label} 전체</span>
                        {region === null && city === draftCity ? (
                          <CheckIcon />
                        ) : (
                          <ChevronRight />
                        )}
                      </button>

                      {/* Actual regions */}
                      <div className="location-picker-region-grid">
                        {regionOptions.map((r) => {
                          const isSelected = region === r.value && city === draftCity;
                          return (
                            <button
                              key={r.value}
                              onClick={() => handleRegionClick(r.value as Region)}
                              className="location-picker-region-cell"
                              style={{
                                minHeight: '44px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '0 16px',
                                fontSize: '14px',
                                fontWeight: isSelected ? 600 : 400,
                                color: isSelected ? '#111827' : '#374151',
                                background: isSelected ? '#f8f9fa' : 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                borderBottom: '1px solid #f3f4f6',
                                letterSpacing: '-0.2px',
                                transition: 'background 120ms ease',
                                textAlign: 'left',
                              }}
                            >
                              <span>{r.label}</span>
                              {isSelected && <CheckIcon />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Safe-area spacer for iOS home indicator */}
            <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
          </div>

          {/* Responsive overrides */}
          <style>{`
            @media (min-width: 768px) {
              .location-picker-panel {
                bottom: auto !important;
                left: 50% !important;
                right: auto !important;
                top: 50% !important;
                width: 440px !important;
                border-radius: 16px !important;
                box-shadow: 0 8px 40px rgba(0,0,0,0.18) !important;
                transition: transform 200ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease !important;
              }
              .location-picker-panel[data-phase="entering"],
              .location-picker-panel[data-phase="closing"] {
                transform: translate(-50%, -50%) scale(0.96) !important;
                opacity: 0 !important;
              }
              .location-picker-panel[data-phase="open"] {
                transform: translate(-50%, -50%) scale(1) !important;
                opacity: 1 !important;
              }
              .location-picker-handle { display: none !important; }
              .location-picker-body { height: 380px !important; }
              /* Seoul shows 25 entries — use 2 columns on desktop only */
              .location-picker-region-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
              }
              .location-picker-region-cell {
                border-right: 1px solid #f3f4f6;
              }
              .location-picker-region-cell:nth-child(2n) {
                border-right: none;
              }
            }
            @media (hover: hover) {
              .location-picker-region-all:hover,
              .location-picker-region-cell:hover {
                background: #f8f9fa !important;
              }
            }
          `}</style>
        </>,
        document.body,
      )}
    </>
  );
}

// ===== Inner pieces =====

function CityRow({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '48px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '14px',
        fontWeight: active ? 700 : 500,
        color: active ? '#111827' : '#6b7280',
        background: active ? '#fff' : 'transparent',
        border: 'none',
        cursor: 'pointer',
        letterSpacing: '-0.2px',
        transition: 'color 120ms ease, background 120ms ease',
      }}
    >
      {/* Vertical accent bar on the left edge when active */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: '10px',
          bottom: '10px',
          width: '3px',
          borderRadius: '0 2px 2px 0',
          background: active ? '#111827' : 'transparent',
          transition: 'background 160ms ease',
        }}
      />
      {label}
    </button>
  );
}

function EmptyHint() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '0 24px',
        textAlign: 'center',
        gap: '10px',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9ca3af',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </div>
      <div style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280', letterSpacing: '-0.2px' }}>
        도시를 먼저 선택하세요
      </div>
      <div style={{ fontSize: '11px', color: '#9ca3af', letterSpacing: '-0.1px', lineHeight: 1.5 }}>
        왼쪽에서 제주 또는 서울을 탭하면<br />지역 목록이 보입니다
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

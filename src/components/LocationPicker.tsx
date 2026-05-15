'use client';

import { useState, useEffect } from 'react';
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
  // Internal city cursor while the sheet is open — does not commit until a
  // region row is tapped or the city row is tapped a second time.
  const [draftCity, setDraftCity] = useState<City | null>(city);

  // Sync draft when props change (e.g. URL-driven initial state)
  useEffect(() => {
    setDraftCity(city);
  }, [city]);

  const regionOptions = REGIONS.filter(
    (r) => r.value !== 'all' && r.city === draftCity,
  );

  const handleOpen = () => {
    setDraftCity(city);
    setOpen(true);
  };

  const handleClose = () => setOpen(false);

  // Left column: 전체 / 제주 / 서울
  const handleCityClick = (c: City | null) => {
    if (c === null) {
      // 전체 — clear and close
      onChange(null, null);
      setOpen(false);
      return;
    }
    if (draftCity === c) {
      // Tapping the already-highlighted city confirms city-only selection
      onChange(c, null);
      setOpen(false);
      return;
    }
    setDraftCity(c);
  };

  // Right column: 전체 (도시 전체) row or a specific region
  const handleRegionClick = (r: Region | null) => {
    if (r === null) {
      // "전체 (도시 전체)" row
      onChange(draftCity, null);
    } else {
      onChange(draftCity, r);
    }
    setOpen(false);
  };

  const label = getButtonLabel(city, region);
  const hasSelection = city !== null;

  return (
    <>
      {/* Trigger button — wrapped so it lays out in the same horizontal
          row the old RegionFilter used to occupy. */}
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

      {/* Backdrop */}
      {open && (
        <div
          onClick={handleClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            background: 'rgba(0,0,0,0.35)',
          }}
        />
      )}

      {/* Sheet / Modal */}
      {open && (
        <div
          style={{
            position: 'fixed',
            zIndex: 41,
            background: '#fff',
            // Mobile: slide-up sheet from bottom
            bottom: 0,
            left: 0,
            right: 0,
            borderRadius: '16px 16px 0 0',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
            // ≥md: centered modal via media query override applied inline via class
          }}
          className="location-picker-panel"
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px 10px',
              borderBottom: '1px solid #f3f4f6',
            }}
          >
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827', letterSpacing: '-0.2px' }}>
              지역 선택
            </span>
            <button
              onClick={handleClose}
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f3f4f6',
                borderRadius: '50%',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280',
              }}
              aria-label="닫기"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Two-column body */}
          <div style={{ display: 'flex', height: '260px' }}>
            {/* Left: city list */}
            <div
              style={{
                width: '96px',
                flexShrink: 0,
                borderRight: '1px solid #f3f4f6',
                overflowY: 'auto',
              }}
            >
              {/* 전체 */}
              <button
                onClick={() => handleCityClick(null)}
                style={{
                  width: '100%',
                  minHeight: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: city === null ? 700 : 400,
                  color: city === null ? '#111827' : '#6b7280',
                  background: city === null ? '#f8f9fa' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  borderBottom: '1px solid #f3f4f6',
                }}
              >
                전체
              </button>
              {CITIES.map((c) => {
                const isActive = draftCity === c.value;
                return (
                  <button
                    key={c.value}
                    onClick={() => handleCityClick(c.value)}
                    style={{
                      width: '100%',
                      minHeight: '48px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: isActive ? 700 : 400,
                      color: isActive ? '#111827' : '#6b7280',
                      background: isActive ? '#f8f9fa' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>

            {/* Right: region list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {draftCity === null ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    fontSize: '13px',
                    color: '#9ca3af',
                  }}
                >
                  도시를 선택하세요
                </div>
              ) : (
                <>
                  {/* 전체 (도시 전체) row */}
                  <button
                    onClick={() => handleRegionClick(null)}
                    style={{
                      width: '100%',
                      minHeight: '48px',
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 16px',
                      fontSize: '14px',
                      fontWeight: region === null && city === draftCity ? 600 : 400,
                      color: region === null && city === draftCity ? '#111827' : '#374151',
                      background: region === null && city === draftCity ? '#f8f9fa' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f3f4f6',
                      gap: '8px',
                    }}
                  >
                    {region === null && city === draftCity && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    전체 ({CITIES.find((c) => c.value === draftCity)?.label ?? ''} 전체)
                  </button>
                  {regionOptions.map((r) => {
                    const isSelected = region === r.value && city === draftCity;
                    return (
                      <button
                        key={r.value}
                        onClick={() => handleRegionClick(r.value as Region)}
                        style={{
                          width: '100%',
                          minHeight: '48px',
                          display: 'flex',
                          alignItems: 'center',
                          padding: '0 16px',
                          fontSize: '14px',
                          fontWeight: isSelected ? 600 : 400,
                          color: isSelected ? '#111827' : '#374151',
                          background: isSelected ? '#f8f9fa' : 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          borderBottom: '1px solid #f3f4f6',
                          gap: '8px',
                        }}
                      >
                        {isSelected && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                        {r.label}
                      </button>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* Safe-area spacer for iOS home indicator */}
          <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
        </div>
      )}

      {/* Responsive override: ≥768px → centered modal */}
      <style>{`
        @media (min-width: 768px) {
          .location-picker-panel {
            bottom: auto !important;
            left: 50% !important;
            right: auto !important;
            top: 50% !important;
            transform: translate(-50%, -50%) !important;
            width: 360px !important;
            border-radius: 16px !important;
            box-shadow: 0 8px 40px rgba(0,0,0,0.18) !important;
          }
        }
      `}</style>
    </>
  );
}

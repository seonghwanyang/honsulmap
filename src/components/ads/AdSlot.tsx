'use client';

import { useEffect, useRef } from 'react';
import { AD_TEST_MODE, AD_UNITS, AdUnit } from '@/lib/ads/config';

interface AdSlotProps {
  unit: keyof typeof AD_UNITS;
  className?: string;
  style?: React.CSSProperties;
}

export default function AdSlot({ unit, className, style }: AdSlotProps) {
  const ref = useRef<HTMLDivElement>(null);
  const ad: AdUnit = AD_UNITS[unit];

  useEffect(() => {
    if (AD_TEST_MODE) return;
    // Real ad network injection goes here later (Phase 4)
  }, [ad.id]);

  const width = ad.width ?? '100%';
  const height = ad.height ?? 'auto';
  const minHeight = ad.height ?? 90;

  return (
    <div
      ref={ref}
      data-ad-unit={ad.id}
      data-ad-label={ad.label}
      className={className}
      style={{
        width,
        height,
        minHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8f9fa',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        color: '#9ca3af',
        fontSize: 11,
        overflow: 'hidden',
        ...style,
      }}
    >
      {AD_TEST_MODE ? (
        <div style={{ textAlign: 'center', lineHeight: 1.4 }}>
          <div style={{ fontWeight: 600, color: '#6b7280' }}>AD</div>
          <div>{ad.label}</div>
          <div style={{ fontSize: 10 }}>#{ad.id}</div>
        </div>
      ) : null}
    </div>
  );
}

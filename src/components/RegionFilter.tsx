'use client';

import { REGIONS } from '@/lib/types';

interface RegionFilterProps {
  selected: string;
  onChange: (region: string) => void;
}

export default function RegionFilter({ selected, onChange }: RegionFilterProps) {
  return (
    <div
      className="flex overflow-x-auto hide-scrollbar"
      style={{ gap: '7px', padding: '9px 16px 10px' }}
    >
      {REGIONS.map((region) => {
        const isSelected = selected === region.value;
        return (
          <button
            key={region.value}
            onClick={() => onChange(region.value)}
            className="flex-shrink-0 transition-colors"
            style={{
              padding: '5px 14px',
              fontSize: '13px',
              fontWeight: isSelected ? 600 : 400,
              letterSpacing: '-0.1px',
              borderRadius: '999px',
              background: isSelected ? '#111827' : '#ffffff',
              color: isSelected ? '#ffffff' : '#6b7280',
              border: isSelected ? '1px solid #111827' : '1px solid #e5e7eb',
              cursor: 'pointer',
              lineHeight: '1.4',
            }}
          >
            {region.label}
          </button>
        );
      })}
    </div>
  );
}

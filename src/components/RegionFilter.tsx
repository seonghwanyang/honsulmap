'use client';

import { REGIONS } from '@/lib/types';

interface RegionFilterProps {
  selected: string;
  onChange: (region: string) => void;
}

export default function RegionFilter({ selected, onChange }: RegionFilterProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto py-2 px-3"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      {REGIONS.map((region) => {
        const isSelected = selected === region.value;
        return (
          <button
            key={region.value}
            onClick={() => onChange(region.value)}
            className="flex-shrink-0 px-3 py-1 text-sm font-medium transition-colors"
            style={{
              borderRadius: '999px',
              background: isSelected ? '#F59E0B' : '#ffffff',
              color: isSelected ? '#ffffff' : '#555555',
              border: isSelected ? '1px solid #F59E0B' : '1px solid #F0F0F0',
              cursor: 'pointer',
            }}
          >
            {region.label}
          </button>
        );
      })}
    </div>
  );
}

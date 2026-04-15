'use client';

import { REGIONS } from '@/lib/types';

interface RegionFilterProps {
  selected: string;
  onChange: (region: string) => void;
}

export default function RegionFilter({ selected, onChange }: RegionFilterProps) {
  return (
    <div className="flex overflow-x-auto hide-scrollbar gap-[7px] px-4 py-[9px]">
      {REGIONS.map((region) => {
        const isSelected = selected === region.value;
        return (
          <button
            key={region.value}
            onClick={() => onChange(region.value)}
            className={`flex-shrink-0 rounded-full py-[5px] px-[14px] text-[13px] leading-[1.4] tracking-[-0.1px] transition-colors cursor-pointer ${
              isSelected
                ? 'bg-[#111827] text-white font-semibold border border-[#111827]'
                : 'bg-white text-gray-500 font-normal border border-gray-200'
            }`}
          >
            {region.label}
          </button>
        );
      })}
    </div>
  );
}

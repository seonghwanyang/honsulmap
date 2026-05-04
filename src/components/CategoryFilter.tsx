'use client';

export type CategoryFilterValue = 'all' | 'bar' | 'guesthouse' | 'party-guesthouse' | 'quiet-guesthouse';

const CATEGORIES: { value: CategoryFilterValue; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'bar', label: '혼술바' },
  { value: 'guesthouse', label: '게하' },
  { value: 'party-guesthouse', label: '파티 게하' },
  { value: 'quiet-guesthouse', label: '조용한 게하' },
];

interface CategoryFilterProps {
  selected: CategoryFilterValue;
  onChange: (category: CategoryFilterValue) => void;
}

export default function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  return (
    <div className="flex overflow-x-auto hide-scrollbar gap-[7px] px-4 py-[7px]">
      {CATEGORIES.map((cat) => {
        const isSelected = selected === cat.value;
        return (
          <button
            key={cat.value}
            onClick={() => onChange(cat.value)}
            className={`flex-shrink-0 rounded-full py-[5px] px-[14px] text-[13px] leading-[1.4] tracking-[-0.1px] transition-colors cursor-pointer ${
              isSelected
                ? 'bg-[#111827] text-white font-semibold border border-[#111827]'
                : 'bg-white text-gray-500 font-normal border border-gray-200'
            }`}
          >
            {cat.label}
          </button>
        );
      })}
    </div>
  );
}

'use client';

import AdSlot from './AdSlot';

export default function NativeListItem() {
  return (
    <div
      className="px-4 py-3.5"
      style={{ borderBottom: '1px solid #f3f4f6', background: '#fafafa' }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="text-xs px-2 py-0.5 font-medium"
          style={{
            background: '#f3f4f6',
            color: '#6b7280',
            borderRadius: 4,
          }}
        >
          광고
        </span>
      </div>
      <AdSlot
        unit="native"
        style={{ border: 'none', background: 'transparent', minHeight: 60 }}
      />
    </div>
  );
}

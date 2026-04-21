'use client';

import AdSlot from './AdSlot';

interface NativeCardProps {
  className?: string;
}

export default function NativeCard({ className }: NativeCardProps) {
  return (
    <div
      className={`rounded-xl overflow-hidden bg-white ${className ?? ''}`}
      style={{ border: '1px solid #e5e7eb' }}
    >
      <div
        className="px-2 py-1 text-[10px] font-medium"
        style={{ color: '#9ca3af', borderBottom: '1px solid #f3f4f6' }}
      >
        광고
      </div>
      <AdSlot unit="native" style={{ border: 'none', borderRadius: 0 }} />
    </div>
  );
}

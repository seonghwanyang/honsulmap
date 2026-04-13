interface AdBannerInlineProps {
  size?: '320x50' | '320x100';
}

export default function AdBannerInline({ size = '320x50' }: AdBannerInlineProps) {
  const height = size === '320x100' ? 100 : 50;

  return (
    <div className="flex items-center justify-center w-full my-2">
      <div
        className="flex items-center justify-center"
        style={{
          width: '320px',
          height: `${height}px`,
          background: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #e5e7eb',
        }}
      >
        <span className="text-xs" style={{ color: '#d1d5db' }}>
          AD
        </span>
      </div>
    </div>
  );
}

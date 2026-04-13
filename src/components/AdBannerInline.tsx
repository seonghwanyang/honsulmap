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
          background: '#2a2d33',
          borderRadius: '4px',
          border: '1px solid #3a3d43',
        }}
      >
        <span className="text-xs" style={{ color: '#888888' }}>
          광고 영역
        </span>
      </div>
    </div>
  );
}

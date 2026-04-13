export default function AdBannerBottom() {
  return (
    <div
      className="fixed left-0 right-0 z-40 flex items-center justify-center"
      style={{
        bottom: '56px',
        height: '50px',
        background: '#1e2127',
        borderTop: '1px solid #2a2d33',
      }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: '320px',
          height: '50px',
          background: '#2a2d33',
          borderRadius: '4px',
        }}
      >
        <span className="text-xs" style={{ color: '#888888' }}>
          광고 영역
        </span>
      </div>
    </div>
  );
}

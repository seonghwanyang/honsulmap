'use client';

import { useMemo } from 'react';
import { AD_TEST_MODE, AD_UNITS, AdUnit, NATIVE_AD_DEFAULT_HEIGHT } from '@/lib/ads/config';

interface AdSlotProps {
  unit: keyof typeof AD_UNITS;
  className?: string;
  style?: React.CSSProperties;
  nativeHeight?: number;
}

function bannerIframeDoc(ad: AdUnit) {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}iframe{display:block;margin:0 auto}</style></head><body><script>var atOptions={key:'${ad.adsterraKey}',format:'iframe',height:${ad.height},width:${ad.width},params:{}};</script><script src="${ad.adsterraScriptSrc}"></script></body></html>`;
}

function nativeIframeDoc(ad: AdUnit) {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0;background:transparent;font-family:-apple-system,BlinkMacSystemFont,'Pretendard',system-ui,sans-serif}</style></head><body><script async="async" data-cfasync="false" src="${ad.adsterraScriptSrc}"></script><div id="container-${ad.adsterraKey}"></div></body></html>`;
}

function Placeholder({ ad }: { ad: AdUnit }) {
  const width = ad.width ?? '100%';
  const height = ad.height ?? NATIVE_AD_DEFAULT_HEIGHT;
  return (
    <div
      data-ad-unit={ad.id}
      data-ad-label={ad.label}
      style={{
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8f9fa',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        color: '#9ca3af',
        fontSize: 11,
      }}
    >
      <div style={{ textAlign: 'center', lineHeight: 1.4 }}>
        <div style={{ fontWeight: 600, color: '#6b7280' }}>AD</div>
        <div>{ad.label}</div>
        <div style={{ fontSize: 10 }}>#{ad.id}</div>
      </div>
    </div>
  );
}

export default function AdSlot({ unit, className, style, nativeHeight }: AdSlotProps) {
  const ad = AD_UNITS[unit];

  const doc = useMemo(() => {
    if (ad.provider === 'adsterra-banner') return bannerIframeDoc(ad);
    if (ad.provider === 'adsterra-native') return nativeIframeDoc(ad);
    return null;
  }, [ad]);

  if (AD_TEST_MODE || ad.provider === 'placeholder' || !doc) {
    return (
      <div className={className} style={style} data-ad-unit={ad.id}>
        <Placeholder ad={ad} />
      </div>
    );
  }

  const isNative = ad.provider === 'adsterra-native';
  const width = ad.width ?? '100%';
  const height = isNative ? nativeHeight ?? NATIVE_AD_DEFAULT_HEIGHT : ad.height ?? 90;

  return (
    <div
      className={className}
      data-ad-unit={ad.id}
      data-ad-label={ad.label}
      style={{
        width: isNative ? '100%' : width,
        maxWidth: isNative ? undefined : width,
        height,
        overflow: 'hidden',
        ...style,
      }}
    >
      <iframe
        title={`ad-${ad.label}`}
        srcDoc={doc}
        width={isNative ? '100%' : width}
        height={height}
        scrolling="no"
        frameBorder={0}
        style={{ display: 'block', border: 0, width: '100%', height: '100%' }}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
}

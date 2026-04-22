export type AdFormat =
  | 'native'
  | 'banner-468x60'
  | 'banner-300x250'
  | 'banner-160x600'
  | 'banner-160x300'
  | 'banner-320x50'
  | 'banner-728x90';

export type AdProvider = 'adsterra-banner' | 'adsterra-native' | 'placeholder';

export interface AdUnit {
  id: string;
  format: AdFormat;
  width: number | null;
  height: number | null;
  label: string;
  provider: AdProvider;
  adsterraKey?: string;
  adsterraScriptSrc?: string;
}

// Adsterra banner iframes all load invoke.js from highperformanceformat.com
// with a per-key path. The native banner uses a different host + a container
// div populated by the async script.
const ADSTERRA_BANNER_BASE = 'https://www.highperformanceformat.com';
const ADSTERRA_NATIVE_SCRIPT =
  'https://pl29192362.profitablecpmratenetwork.com/240681be25c984bf178926a8d3641744/invoke.js';

export const AD_UNITS: Record<string, AdUnit> = {
  native: {
    id: '29091863',
    format: 'native',
    width: null,
    height: null,
    label: 'NativeBanner_1',
    provider: 'adsterra-native',
    adsterraKey: '240681be25c984bf178926a8d3641744',
    adsterraScriptSrc: ADSTERRA_NATIVE_SCRIPT,
  },
  banner468x60: {
    id: '29091864',
    format: 'banner-468x60',
    width: 468,
    height: 60,
    label: '468x60_1',
    provider: 'adsterra-banner',
    adsterraKey: '42b4ceeb2cbf78a216490b838cbc4cb4',
    adsterraScriptSrc: `${ADSTERRA_BANNER_BASE}/42b4ceeb2cbf78a216490b838cbc4cb4/invoke.js`,
  },
  banner300x250: {
    id: '29091865',
    format: 'banner-300x250',
    width: 300,
    height: 250,
    label: '300x250_1',
    provider: 'placeholder',
  },
  banner160x600: {
    id: '29091866',
    format: 'banner-160x600',
    width: 160,
    height: 600,
    label: '160x600_1',
    provider: 'adsterra-banner',
    adsterraKey: '114c471d4dee31cb5bc4d616a7a78916',
    adsterraScriptSrc: `${ADSTERRA_BANNER_BASE}/114c471d4dee31cb5bc4d616a7a78916/invoke.js`,
  },
  banner160x300: {
    id: '29091867',
    format: 'banner-160x300',
    width: 160,
    height: 300,
    label: '160x300_1',
    provider: 'placeholder',
  },
  banner320x50: {
    id: '29091868',
    format: 'banner-320x50',
    width: 320,
    height: 50,
    label: '320x50_1',
    provider: 'adsterra-banner',
    adsterraKey: '845b9f55d71416170c1ac897130c7830',
    adsterraScriptSrc: `${ADSTERRA_BANNER_BASE}/845b9f55d71416170c1ac897130c7830/invoke.js`,
  },
  banner728x90: {
    id: '29091869',
    format: 'banner-728x90',
    width: 728,
    height: 90,
    label: '728x90_1',
    provider: 'adsterra-banner',
    adsterraKey: '40c0713fb06b188a4c28d060466d35a6',
    adsterraScriptSrc: `${ADSTERRA_BANNER_BASE}/40c0713fb06b188a4c28d060466d35a6/invoke.js`,
  },
};

export const AD_TEST_MODE = process.env.NEXT_PUBLIC_AD_TEST_MODE === 'true';

// Native ads don't report their natural height through the iframe boundary,
// so we pick a sensible default per usage context.
export const NATIVE_AD_DEFAULT_HEIGHT = 280;

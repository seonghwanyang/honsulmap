export type AdFormat =
  | 'native'
  | 'banner-468x60'
  | 'banner-300x250'
  | 'banner-160x600'
  | 'banner-160x300'
  | 'banner-320x50'
  | 'banner-320x100'
  | 'banner-728x90';

export type AdProvider = 'adsterra-banner' | 'adsterra-native' | 'adfit-banner' | 'placeholder';

export interface AdUnit {
  id: string;
  format: AdFormat;
  width: number | null;
  height: number | null;
  label: string;
  provider: AdProvider;
  adsterraKey?: string;
  adsterraScriptSrc?: string;
  adfitUnitId?: string;
}

// Adsterra banner iframes all load invoke.js from highperformanceformat.com
// with a per-key path. The native banner uses a different host + a container
// div populated by the async script.
const ADSTERRA_BANNER_BASE = 'https://www.highperformanceformat.com';
const ADSTERRA_NATIVE_SCRIPT =
  'https://pl29192362.profitablecpmratenetwork.com/240681be25c984bf178926a8d3641744/invoke.js';

// AdFit (Kakao) — unit IDs (DAN-xxxx) come from env so they can be set in
// Vercel without a code change. Empty until configured → AdSlot renders
// nothing for that slot (no ugly placeholder in prod).
const ADFIT_UNIT_BANNER = process.env.NEXT_PUBLIC_ADFIT_UNIT_ID_BANNER || 'DAN-cLc7cLFLPsFkagsM';
const ADFIT_UNIT_INLINE = process.env.NEXT_PUBLIC_ADFIT_UNIT_ID_INLINE || 'DAN-eLH0m2YzTgNvPzgn';
const ADFIT_UNIT_COMMUNITY =
  process.env.NEXT_PUBLIC_ADFIT_UNIT_ID_COMMUNITY || 'DAN-NXWQdRAqsJGK6M04';
// Extra 300x250 units for the story feed — AdFit renders a unit only once per
// page, so each inline slot needs its own. Empty until their DAN-ids are set.
const ADFIT_UNIT_INLINE2 =
  process.env.NEXT_PUBLIC_ADFIT_UNIT_ID_INLINE2 || 'DAN-oEoNpOw4ZPPPvSEz';
const ADFIT_UNIT_INLINE3 =
  process.env.NEXT_PUBLIC_ADFIT_UNIT_ID_INLINE3 || 'DAN-AgBCIugRCWKDxmcq';
const ADFIT_UNIT_INLINE4 =
  process.env.NEXT_PUBLIC_ADFIT_UNIT_ID_INLINE4 || 'DAN-2XkmnriU9ohgu07S';

export const AD_UNITS: Record<string, AdUnit> = {
  adfitBottom: {
    id: 'adfit-bottom',
    format: 'banner-320x50',
    width: 320,
    height: 50,
    label: 'AdFit_Bottom_320x50',
    provider: 'adfit-banner',
    adfitUnitId: ADFIT_UNIT_BANNER,
  },
  adfitInline: {
    id: 'adfit-inline',
    format: 'banner-300x250',
    width: 300,
    height: 250,
    label: 'AdFit_Inline_300x250',
    provider: 'adfit-banner',
    adfitUnitId: ADFIT_UNIT_INLINE,
  },
  adfitInline2: {
    id: 'adfit-inline-2',
    format: 'banner-300x250',
    width: 300,
    height: 250,
    label: 'AdFit_Inline2_300x250',
    provider: 'adfit-banner',
    adfitUnitId: ADFIT_UNIT_INLINE2,
  },
  adfitInline3: {
    id: 'adfit-inline-3',
    format: 'banner-300x250',
    width: 300,
    height: 250,
    label: 'AdFit_Inline3_300x250',
    provider: 'adfit-banner',
    adfitUnitId: ADFIT_UNIT_INLINE3,
  },
  adfitInline4: {
    id: 'adfit-inline-4',
    format: 'banner-300x250',
    width: 300,
    height: 250,
    label: 'AdFit_Inline4_300x250',
    provider: 'adfit-banner',
    adfitUnitId: ADFIT_UNIT_INLINE4,
  },
  adfitCommunity: {
    id: 'adfit-community',
    format: 'banner-320x100',
    width: 320,
    height: 100,
    label: 'AdFit_Community_320x100',
    provider: 'adfit-banner',
    adfitUnitId: ADFIT_UNIT_COMMUNITY,
  },
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

// Story-feed inline ad slots, in order. Each is a distinct unit because AdFit
// renders a given unit only once per page; capped at 4 (page-level ad limit).
// Slots whose unit has no DAN-id yet simply render nothing.
export const INLINE_AD_UNITS = [
  'adfitInline',
  'adfitInline2',
  'adfitInline3',
  'adfitInline4',
];

export const AD_TEST_MODE = process.env.NEXT_PUBLIC_AD_TEST_MODE === 'true';

// Native ads don't report their natural height through the iframe boundary,
// so we pick a sensible default per usage context.
export const NATIVE_AD_DEFAULT_HEIGHT = 280;

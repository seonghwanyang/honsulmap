export type AdFormat =
  | 'native'
  | 'banner-468x60'
  | 'banner-300x250'
  | 'banner-160x600'
  | 'banner-160x300'
  | 'banner-320x50'
  | 'banner-728x90';

export interface AdUnit {
  id: string;
  format: AdFormat;
  width: number | null;
  height: number | null;
  label: string;
}

export const AD_UNITS: Record<string, AdUnit> = {
  native: {
    id: '29091863',
    format: 'native',
    width: null,
    height: null,
    label: 'NativeBanner_1',
  },
  banner468x60: {
    id: '29091864',
    format: 'banner-468x60',
    width: 468,
    height: 60,
    label: '468x60_1',
  },
  banner300x250: {
    id: '29091865',
    format: 'banner-300x250',
    width: 300,
    height: 250,
    label: '300x250_1',
  },
  banner160x600: {
    id: '29091866',
    format: 'banner-160x600',
    width: 160,
    height: 600,
    label: '160x600_1',
  },
  banner160x300: {
    id: '29091867',
    format: 'banner-160x300',
    width: 160,
    height: 300,
    label: '160x300_1',
  },
  banner320x50: {
    id: '29091868',
    format: 'banner-320x50',
    width: 320,
    height: 50,
    label: '320x50_1',
  },
  banner728x90: {
    id: '29091869',
    format: 'banner-728x90',
    width: 728,
    height: 90,
    label: '728x90_1',
  },
};

export const AD_TEST_MODE = true;

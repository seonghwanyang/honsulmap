// Server-component shell — reads Vercel's IP geo headers to pick a
// default city for first-time visitors (Jeju residents land on Jeju,
// everyone else lands on Seoul), then hands off to the client map.
//
// URL `?city=` always overrides geo. Local dev (no Vercel headers)
// falls through to 'seoul'.
import { headers } from 'next/headers';
import MapClient from './MapClient';
import type { City } from '@/lib/types';

// KR-49 is the Jeju Special Self-Governing Province subdivision code
// in ISO 3166-2.
const JEJU_REGION_CODE = '49';

async function detectInitialCity(): Promise<City> {
  const h = await headers();
  const country = h.get('x-vercel-ip-country') ?? '';
  const region = h.get('x-vercel-ip-country-region') ?? '';
  if (country === 'KR' && region === JEJU_REGION_CODE) return 'jeju';
  return 'seoul';
}

export default async function MapPage() {
  const initialCity = await detectInitialCity();
  return <MapClient initialCity={initialCity} />;
}

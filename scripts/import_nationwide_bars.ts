/**
 * Import nationwide (non-Jeju/Seoul/Busan) bars from
 * scripts/nationwide_spots_data.ts.
 *
 * Idempotent: upserts on `slug`. Each row carries its own city + region.
 *
 * Usage: npx tsx scripts/import_nationwide_bars.ts
 *
 * Prereq: apply src/data/migrations/2026-05-31_nationwide_prefix_unify.sql
 * first (adds the new cities + prefixed region vocabulary).
 *
 * Then: python scripts/naver_map_resync_city.py <city>  (per new city)
 *       npx tsx scripts/sync_naver_place.ts
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { NATIONWIDE_SPOTS, REGION_CENTROID } from './nationwide_spots_data';

const FALLBACK_CENTER: [number, number] = [36.5, 127.8]; // 국토 중앙 (대략)

(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: existingRows, error: existingErr } = await sb.from('spots').select('slug');
  if (existingErr) {
    console.error('Failed to load existing slugs:', existingErr.message);
    process.exit(1);
  }
  const existingSlugs = new Set<string>((existingRows ?? []).map((r) => r.slug));

  const inserts: Record<string, unknown>[] = [];
  const batchSlugs = new Set<string>();
  const byCity: Record<string, number> = {};

  for (const spot of NATIONWIDE_SPOTS) {
    let slug = spot.slug;
    let n = 2;
    while ((existingSlugs.has(slug) && !batchSlugs.has(spot.slug)) || batchSlugs.has(slug)) {
      slug = `${spot.slug}-${n}`;
      n++;
    }
    batchSlugs.add(slug);

    const [lat, lng] = REGION_CENTROID[spot.region] ?? FALLBACK_CENTER;
    inserts.push({
      name: spot.name,
      slug,
      instagram_id: spot.instagram_id,
      category: 'bar',
      city: spot.city,
      region: spot.region,
      address: spot.address,
      lat,
      lng,
      memo: spot.memo,
    });
    byCity[spot.city] = (byCity[spot.city] ?? 0) + 1;
  }

  console.log(`Prepared ${inserts.length} nationwide rows`);
  console.log('  by city:', byCity);

  const CHUNK = 50;
  let inserted = 0;
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const chunk = inserts.slice(i, i + CHUNK);
    const { error, count } = await sb
      .from('spots')
      .upsert(chunk, { onConflict: 'slug', count: 'exact' });
    if (error) {
      console.error(`  ! chunk ${i} failed: ${error.message}`);
      if (/city|region/i.test(error.message)) {
        console.error('\nApply 2026-05-31_nationwide_prefix_unify.sql first, then re-run.');
        process.exit(1);
      }
      continue;
    }
    inserted += count ?? chunk.length;
  }

  const { count: total } = await sb.from('spots').select('*', { count: 'exact', head: true });
  console.log(`\ninserted=${inserted} | spots total=${total}`);
})();

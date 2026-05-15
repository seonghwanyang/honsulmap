/**
 * Import Seoul honsul bar rows from scripts/seoul_spots_data.ts.
 *
 * Idempotent: re-running upserts on `slug` so existing rows are preserved
 * (good for fixing typos / re-running after schema migration).
 *
 * Usage: npx tsx scripts/import_seoul_bars.ts
 *
 * Prereqs (in order):
 *   1. Apply src/data/migrations/2026-05-15_spots_city_and_seoul_regions.sql
 *      via Supabase SQL Editor (adds city column + expands spot_requests
 *      region CHECK).
 *   2. Make sure .env.local has NEXT_PUBLIC_SUPABASE_URL and
 *      SUPABASE_SERVICE_ROLE_KEY.
 *
 * Then run naver_map_resync.py (Seoul-adapted) to fill exact lat/lng,
 * address, and naver_place_id per spot.
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { SEOUL_SPOTS, REGION_CENTROID } from './seoul_spots_data';

interface SpotInsert {
  name: string;
  slug: string;
  instagram_id: string | null;
  category: 'bar';
  city: 'seoul';
  region: string;
  address: string;
  lat: number;
  lng: number;
  memo: string | null;
}

(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Pre-load existing slugs so chain branches with the same Korean name
  // don't collide with already-imported rows.
  const { data: existingRows, error: existingErr } = await sb
    .from('spots')
    .select('slug');
  if (existingErr) {
    console.error('Failed to load existing slugs:', existingErr.message);
    process.exit(1);
  }
  const existingSlugs = new Set<string>((existingRows ?? []).map((r) => r.slug));

  const inserts: SpotInsert[] = [];
  const batchSlugs = new Set<string>();
  const byRegion: Record<string, number> = {};

  for (const spot of SEOUL_SPOTS) {
    let slug = spot.slug;
    let n = 2;
    // Only suffix for true cross-batch collisions (an already-existing
    // jeju spot with the same slug). Within-Seoul slugs are unique by
    // construction in the data file.
    while ((existingSlugs.has(slug) && !batchSlugs.has(spot.slug)) || batchSlugs.has(slug)) {
      slug = `${spot.slug}-${n}`;
      n++;
    }
    batchSlugs.add(slug);

    const [lat, lng] = REGION_CENTROID[spot.region];
    inserts.push({
      name: spot.name,
      slug,
      instagram_id: spot.instagram_id,
      category: 'bar',
      city: 'seoul',
      region: spot.region,
      address: spot.address,
      lat,
      lng,
      memo: spot.memo,
    });
    byRegion[spot.region] = (byRegion[spot.region] ?? 0) + 1;
  }

  console.log(`Prepared ${inserts.length} Seoul rows`);
  console.log('  by region:', byRegion);
  const withIg = inserts.filter((s) => s.instagram_id).length;
  console.log(`  with IG handle: ${withIg} / without: ${inserts.length - withIg}`);

  const CHUNK = 50;
  let inserted = 0;
  let errors = 0;
  for (let i = 0; i < inserts.length; i += CHUNK) {
    const chunk = inserts.slice(i, i + CHUNK);
    const { error, count } = await sb
      .from('spots')
      .upsert(chunk, { onConflict: 'slug', count: 'exact' });
    if (error) {
      console.error(`  ! chunk ${i}–${i + chunk.length} failed: ${error.message}`);
      errors += chunk.length;
      if (error.message.toLowerCase().includes('city')) {
        console.error(
          '\nIt looks like the city column is missing. Apply ' +
            'src/data/migrations/2026-05-15_spots_city_and_seoul_regions.sql ' +
            'in the Supabase SQL editor and re-run.',
        );
        process.exit(1);
      }
      continue;
    }
    inserted += count ?? chunk.length;
  }

  const { count: total } = await sb
    .from('spots')
    .select('*', { count: 'exact', head: true });
  const { count: seoulTotal } = await sb
    .from('spots')
    .select('*', { count: 'exact', head: true })
    .eq('city', 'seoul');

  console.log('\n──────────── Summary ────────────');
  console.log(`inserted=${inserted} errors=${errors}`);
  console.log(`spots row count (all): ${total}`);
  console.log(`spots row count (seoul): ${seoulTotal}`);
})();

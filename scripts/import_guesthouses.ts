/**
 * Import guesthouse rows from .tmp-gh.json into spots table.
 *
 * Idempotent: re-running will UPSERT on `slug` so existing rows are preserved.
 *
 * Usage: npx tsx scripts/import_guesthouses.ts
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { createSlug } from '../src/lib/utils';

// ────────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────────

const SOURCE_PATH = '.tmp-gh.json';

// 지역 mapping (xlsx label → DB enum)
const REGION_MAP: Record<string, 'jeju' | 'aewol' | 'seogwipo' | 'east'> = {
  '제주시(공항/시내)': 'jeju',
  '서쪽(애월/한림)': 'aewol',
  '남쪽(서귀포/중문)': 'seogwipo',
  '동쪽(구좌/성산/조천)': 'east',
};

// Region centroid placeholders (admin will correct via Naver Place matching)
const REGION_CENTROID: Record<string, { lat: number; lng: number }> = {
  jeju: { lat: 33.5097, lng: 126.5219 },
  aewol: { lat: 33.4625, lng: 126.3306 },
  seogwipo: { lat: 33.2541, lng: 126.5601 },
  east: { lat: 33.4548, lng: 126.7926 },
};

const PLACEHOLDER_ADDRESS = '제주특별자치도 (좌표 보정 대기)';

// vibe tag mapping
const PARTY_TAGS = new Set(['대형 파티', '소규모 파티', '소셜']);
const QUIET_TAGS = new Set(['조용한', '힐링', '소규모 소통']);

function classifyVibe(note: string): 'party' | 'quiet' | 'general' {
  const m = note.match(/^\[([^\]]+)\]/);
  if (!m) return 'general';
  const tags = m[1].split('/').map((t) => t.trim());
  for (const t of tags) {
    if (PARTY_TAGS.has(t)) return 'party';
  }
  for (const t of tags) {
    if (QUIET_TAGS.has(t)) return 'quiet';
  }
  return 'general';
}

function parseHandle(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === '확인불가') return null;
  return trimmed.replace(/^@/, '');
}

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

interface SpotInsert {
  name: string;
  slug: string;
  instagram_id: string | null;
  category: 'guesthouse';
  region: 'jeju' | 'aewol' | 'seogwipo' | 'east';
  address: string;
  lat: number;
  lng: number;
  memo: string | null;
  vibe_tags: string[];
}

(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Pre-load existing slugs for collision handling
  const { data: existingRows, error: existingErr } = await sb
    .from('spots')
    .select('slug');
  if (existingErr) {
    console.error('Failed to load existing slugs:', existingErr.message);
    process.exit(1);
  }
  const existingSlugs = new Set<string>((existingRows ?? []).map((r) => r.slug));

  const raw = readFileSync(SOURCE_PATH, 'utf8');
  const json = JSON.parse(raw) as { rows: unknown[][] };
  const rows = json.rows.slice(1); // drop header

  const inserts: SpotInsert[] = [];
  // Track slugs assigned within this batch to avoid intra-batch dupes too.
  const batchSlugs = new Set<string>();

  let skipped = 0;
  const byRegion: Record<string, number> = {};
  const byVibe: Record<string, number> = {};

  for (const row of rows) {
    const [regionRaw, nameRaw, handleRaw, , noteRaw] = row as [
      string,
      string,
      string,
      string,
      string,
    ];

    const name = (nameRaw ?? '').trim();
    if (!name) {
      skipped++;
      continue;
    }
    const region = REGION_MAP[regionRaw];
    if (!region) {
      console.warn(`  ! unknown region "${regionRaw}" for "${name}" — skipping`);
      skipped++;
      continue;
    }

    // Build a unique slug. createSlug() may collide with existing 71 spots
    // or other guesthouses sharing names; suffix numerically when needed.
    const base = createSlug(name);
    let slug = base;
    let n = 2;
    while (existingSlugs.has(slug) || batchSlugs.has(slug)) {
      slug = `${base}-${n}`;
      n++;
    }
    batchSlugs.add(slug);

    const note = (noteRaw ?? '').trim();
    const vibe = classifyVibe(note);
    const centroid = REGION_CENTROID[region];

    inserts.push({
      name,
      slug,
      instagram_id: parseHandle(handleRaw ?? ''),
      category: 'guesthouse',
      region,
      address: PLACEHOLDER_ADDRESS,
      lat: centroid.lat,
      lng: centroid.lng,
      memo: note || null,
      vibe_tags: [vibe],
    });
    byRegion[region] = (byRegion[region] ?? 0) + 1;
    byVibe[vibe] = (byVibe[vibe] ?? 0) + 1;
  }

  console.log(`Prepared ${inserts.length} rows (skipped ${skipped})`);
  console.log('  by region:', byRegion);
  console.log('  by vibe:', byVibe);

  // Upsert in chunks
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
      // If first chunk fails on schema (e.g. vibe_tags column missing), bail.
      if (error.message.toLowerCase().includes('vibe_tags')) {
        console.error('\nIt looks like the vibe_tags column is missing.');
        console.error(
          'Apply src/data/migrations/2026-05-04_spots_vibe_tags.sql in the Supabase SQL editor and re-run.',
        );
        process.exit(1);
      }
      continue;
    }
    inserted += count ?? chunk.length;
  }

  // Final row count
  const { count: total } = await sb
    .from('spots')
    .select('*', { count: 'exact', head: true });

  console.log('\n──────────── Summary ────────────');
  console.log(`inserted=${inserted} skipped=${skipped} errors=${errors}`);
  console.log(`spots row count: ${total}`);
})();

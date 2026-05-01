/**
 * One-shot script: for every spot with a naver_place_id, fetch
 * m.place.naver.com and pull business_hours / phone / image_urls
 * out of the embedded __APOLLO_STATE__ JSON, then upsert into Supabase.
 *
 * Run:  npx tsx scripts/sync_naver_place.ts
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  Referer: 'https://m.place.naver.com/',
};

type PlaceData = {
  business_hours: string | null;
  phone: string | null;
  image_urls: string[] | null;
  rating: number | null;
  review_count: number | null;
};

function formatHours(openingHours: unknown): string | null {
  // Naver returns multiple shapes. Common one is:
  //   { "businessStatus": {...}, "businessHours": [{ "businessDay": "월", "from": "1900", "to": "0200" }, ...] }
  // We flatten to a single string like "매일 19:00 ~ 02:00" or per-day list.
  if (!openingHours || typeof openingHours !== 'object') return null;
  const oh = openingHours as { businessHours?: Array<Record<string, unknown>>; description?: string };
  const list = Array.isArray(oh.businessHours) ? oh.businessHours : [];
  if (!list.length) return typeof oh.description === 'string' ? oh.description : null;
  const fmt = (t: unknown) => {
    if (typeof t !== 'string' || t.length < 4) return String(t ?? '');
    return `${t.slice(0, 2)}:${t.slice(2, 4)}`;
  };
  const parts = list
    .map((h) => {
      const day = h.businessDay || h.day || '';
      const from = fmt(h.from);
      const to = fmt(h.to);
      return `${day} ${from}~${to}`.trim();
    })
    .filter(Boolean);
  return parts.length ? parts.join(' / ') : null;
}

async function fetchPlace(placeId: string): Promise<PlaceData | null> {
  // Try restaurant first; fallback to /place if 404 (cafes, etc.)
  for (const path of ['restaurant', 'place', 'cafe', 'accommodation']) {
    const res = await fetch(`https://m.place.naver.com/${path}/${placeId}/home`, {
      headers: HEADERS,
    });
    if (!res.ok) continue;
    const html = await res.text();
    const m = html.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});/);
    if (!m) continue;
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const baseKey = `PlaceDetailBase:${placeId}`;
    const base = (json[baseKey] || {}) as Record<string, unknown>;
    if (!base.name) continue;

    // Phone (real first, then virtual)
    const phone = (base.phone as string | null) || (base.virtualPhone as string | null) || null;

    // Hours (Naver place may store as oh OR opentime list)
    const hours = formatHours(base.openingHours);

    // Photos: scrape Photo:* entries
    const photoEntries = Object.entries(json).filter(([k]) => k.startsWith('Photo:'));
    const image_urls = photoEntries
      .map(([, v]) => {
        const obj = v as Record<string, unknown>;
        return (obj?.imageUrl as string) || (obj?.url as string) || null;
      })
      .filter((u): u is string => !!u && u.startsWith('http'))
      .slice(0, 12); // cap so we don't bloat the row

    const rating = typeof base.visitorReviewsScore === 'number' ? base.visitorReviewsScore : null;
    const review_count =
      typeof base.visitorReviewsTotal === 'number' ? base.visitorReviewsTotal : null;

    return {
      business_hours: hours,
      phone,
      image_urls: image_urls.length ? image_urls : null,
      rating,
      review_count,
    };
  }
  return null;
}

(async () => {
  const { data: spots, error } = await s
    .from('spots')
    .select('id, name, naver_place_id, business_hours, phone, image_urls')
    .not('naver_place_id', 'is', null)
    .neq('naver_place_id', '');
  if (error) {
    console.error(error);
    return;
  }

  console.log(`Targeting ${spots?.length ?? 0} spots with naver_place_id`);
  let updated = 0;
  let missed = 0;
  let skipped = 0;

  for (const sp of spots || []) {
    try {
      const data = await fetchPlace(sp.naver_place_id);
      if (!data) {
        console.log(`  ${sp.name} (${sp.naver_place_id}) → no data`);
        missed++;
        continue;
      }

      // Only overwrite null-ish fields. Skip if everything we'd set is empty.
      const patch: Record<string, unknown> = {};
      if (!sp.business_hours && data.business_hours) patch.business_hours = data.business_hours;
      if (!sp.phone && data.phone) patch.phone = data.phone;
      if ((!sp.image_urls || sp.image_urls.length === 0) && data.image_urls)
        patch.image_urls = data.image_urls;
      // Always refresh rating + review count (cheap to update, changes daily)
      if (data.rating != null) patch.naver_rating = data.rating;
      if (data.review_count != null) patch.naver_review_count = data.review_count;

      if (Object.keys(patch).length === 0) {
        skipped++;
        continue;
      }

      const { error: updErr } = await s.from('spots').update(patch).eq('id', sp.id);
      if (updErr) {
        console.log(`  ${sp.name} update error:`, updErr.message);
        missed++;
        continue;
      }
      console.log(
        `  ${sp.name} ← ${Object.keys(patch).join(', ')}` +
          (data.rating ? ` (★ ${data.rating} / ${data.review_count})` : ''),
      );
      updated++;
    } catch (e) {
      console.log(`  ${sp.name} error:`, (e as Error).message);
      missed++;
    }
    // gentle pacing — Naver has loose rate limits but no need to hammer
    await new Promise((r) => setTimeout(r, 800));
  }

  console.log(`\nDone. updated=${updated} skipped=${skipped} missed=${missed}`);
})();

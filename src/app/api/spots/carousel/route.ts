import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Spots that posted a fresh IG story in the last 24h. Returns one row
// per spot (most recent story only), ordered by recency. Drives the
// "지금 핫" carousel above the map.
export async function GET() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Over-fetch recent stories — Supabase JS doesn't expose DISTINCT ON,
  // so we dedupe by spot_id in JS keeping the first (most recent) hit.
  // We also keep the latest story's thumbnail_url so spots missing
  // naver_photos can still show a photo (the IG story thumb).
  const { data: stories, error: storiesError } = await supabase
    .from('stories')
    .select('spot_id, posted_at, thumbnail_url, media_url, media_type')
    .gte('posted_at', since)
    .order('posted_at', { ascending: false })
    .limit(200);

  if (storiesError) {
    return NextResponse.json({ error: storiesError.message }, { status: 500 });
  }

  const seen = new Set<string>();
  const orderedSpotIds: string[] = [];
  const latestBySpot = new Map<string, string>();
  const storyThumbBySpot = new Map<string, string | null>();
  for (const s of stories || []) {
    if (seen.has(s.spot_id)) continue;
    seen.add(s.spot_id);
    orderedSpotIds.push(s.spot_id);
    latestBySpot.set(s.spot_id, s.posted_at);
    // Use the explicit thumbnail when present, otherwise the media_url
    // works as a thumbnail for image-type stories.
    const thumb = s.thumbnail_url || (s.media_type === 'image' ? s.media_url : null);
    storyThumbBySpot.set(s.spot_id, thumb);
    if (orderedSpotIds.length >= 10) break;
  }

  if (orderedSpotIds.length === 0) {
    return NextResponse.json([], {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=180' },
    });
  }

  const { data: spots, error: spotsError } = await supabase
    .from('spots')
    .select('id, slug, name, region, naver_photos')
    .in('id', orderedSpotIds);

  if (spotsError) {
    return NextResponse.json({ error: spotsError.message }, { status: 500 });
  }

  const spotById = new Map((spots || []).map((s) => [s.id, s]));
  const out = orderedSpotIds
    .map((id) => {
      const spot = spotById.get(id);
      if (!spot) return null;
      // Prefer naver_photos (curated, hot-link friendly), fall back to
      // the latest story's thumbnail so no card renders empty.
      const naverPhoto = spot.naver_photos?.[0] ?? null;
      return {
        slug: spot.slug,
        name: spot.name,
        region: spot.region,
        naver_photo: naverPhoto ?? storyThumbBySpot.get(id) ?? null,
        latest_story_at: latestBySpot.get(id) ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return NextResponse.json(out, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=180' },
  });
}

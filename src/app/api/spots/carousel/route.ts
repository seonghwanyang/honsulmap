import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Spots that posted a fresh IG story in the last 24h. Returns one row
// per spot (most recent story only), ordered by recency. Drives the
// "실시간 근황" carousel above the map.
//
// Accepts ?city=<jeju|seoul> to scope the strip to one city — the
// carousel exposes this as a dropdown so users in 서울 don't see only
// 제주 spots and vice versa.
export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get('city');
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Over-fetch recent stories — Supabase JS doesn't expose DISTINCT ON,
  // so we dedupe by spot_id in JS keeping the first (most recent) hit.
  // We also keep the latest story's thumbnail_url so spots missing
  // naver_photos can still show a photo (the IG story thumb). When a
  // city is requested we filter via an inner join on spots.city.
  let storiesQ = supabase
    .from('stories')
    .select('spot_id, posted_at, thumbnail_url, media_url, media_type, spot:spots!inner(city)')
    .gte('posted_at', since)
    .order('posted_at', { ascending: false })
    .limit(200);
  if (city && city !== 'all') {
    storiesQ = storiesQ.eq('spot.city', city);
  }
  const { data: stories, error: storiesError } = await storiesQ;

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

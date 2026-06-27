import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Lightweight endpoint for the map page. Returns spot rows + each spot's
// latest story timestamp, without any story bodies. Region/category
// filtering is done client-side from the same payload — so toggling chips
// doesn't refetch.
export async function GET() {
  const spotsQuery = supabase
    .from('spots')
    .select(
      'id, name, slug, instagram_id, category, city, region, address, lat, lng, phone, business_hours, memo, naver_place_id, naver_rating, naver_review_count, vibe_tags, like_count, mood_up, mood_down, created_at, benefit_title, benefit_active, benefit_expires_at',
    )
    .order('created_at', { ascending: false });

  // Fetch only (spot_id, posted_at) ordered desc, then keep first per spot.
  // Drops the heavy media_url / thumbnail_url payload that /api/spots was
  // returning for every story in history.
  const latestQuery = supabase
    .from('stories')
    .select('spot_id, posted_at')
    .order('posted_at', { ascending: false });

  const [spotsRes, latestRes] = await Promise.all([spotsQuery, latestQuery]);
  if (spotsRes.error) {
    return NextResponse.json({ error: spotsRes.error.message }, { status: 500 });
  }
  if (latestRes.error) {
    return NextResponse.json({ error: latestRes.error.message }, { status: 500 });
  }

  const latestBySpot = new Map<string, string>();
  for (const row of latestRes.data || []) {
    if (!latestBySpot.has(row.spot_id)) latestBySpot.set(row.spot_id, row.posted_at);
  }

  const out = (spotsRes.data || []).map((spot) => ({
    ...spot,
    stories: [] as never[],
    latest_story_at: latestBySpot.get(spot.id) ?? null,
  }));

  return NextResponse.json(out, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}

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
      'id, name, slug, instagram_id, avatar_url, category, city, region, address, lat, lng, phone, business_hours, memo, naver_place_id, naver_rating, naver_review_count, vibe_tags, like_count, mood_up, mood_down, created_at, benefit_title, benefit_active, benefit_expires_at, ad_marker_until',
    )
    .order('created_at', { ascending: false });

  // Fetch only (spot_id, posted_at) ordered desc, then keep first per spot.
  // Drops the heavy media_url / thumbnail_url payload that /api/spots was
  // returning for every story in history.
  const latestQuery = supabase
    .from('stories')
    .select('spot_id, posted_at')
    .order('posted_at', { ascending: false });

  // Fresh(24h) 스토리의 썸네일만 별도로 — 핀 옆 미니 스토리 카드용.
  // 전체 히스토리에 URL 컬럼을 실으면 무거워지는 문제(위 주석) 때문에 24h 창 한정.
  const freshSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const freshThumbQuery = supabase
    .from('stories')
    .select('spot_id, media_type, media_url, thumbnail_url')
    .gte('posted_at', freshSince)
    .order('posted_at', { ascending: false });

  const [spotsRes, latestRes, freshRes] = await Promise.all([spotsQuery, latestQuery, freshThumbQuery]);
  if (spotsRes.error) {
    return NextResponse.json({ error: spotsRes.error.message }, { status: 500 });
  }
  if (latestRes.error) {
    return NextResponse.json({ error: latestRes.error.message }, { status: 500 });
  }
  if (freshRes.error) {
    return NextResponse.json({ error: freshRes.error.message }, { status: 500 });
  }

  const latestBySpot = new Map<string, string>();
  for (const row of latestRes.data || []) {
    if (!latestBySpot.has(row.spot_id)) latestBySpot.set(row.spot_id, row.posted_at);
  }

  // '가장 최신' 스토리만 대상 — 최신 스토리에 시각 자료가 없으면(썸네일 없는 영상)
  // 그 스팟은 미니카드 없이 감 (한 단계 옛 스토리로 대체하지 않음).
  const seenThumb = new Set<string>();
  const thumbBySpot = new Map<string, string>();
  for (const row of freshRes.data || []) {
    if (seenThumb.has(row.spot_id)) continue;
    seenThumb.add(row.spot_id);
    const thumb = row.thumbnail_url || (row.media_type === 'image' ? row.media_url : null);
    if (thumb) thumbBySpot.set(row.spot_id, thumb);
  }

  const out = (spotsRes.data || []).map((spot) => ({
    ...spot,
    stories: [] as never[],
    latest_story_at: latestBySpot.get(spot.id) ?? null,
    latest_story_thumb: thumbBySpot.get(spot.id) ?? null,
  }));

  // no-store: 사장님이 혜택/정보를 저장하고 새로고침하면 즉시 반영돼야 한다
  // (제품 결정 2026-07-06). 현 트래픽 규모에선 CDN 캐시 이득보다 혼란 비용이 큼.
  return NextResponse.json(out, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

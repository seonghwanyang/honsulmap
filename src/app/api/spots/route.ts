import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { Region, SpotCategory } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region') as Region | null;
  const category = searchParams.get('category') as SpotCategory | null;

  // Fetch spots and all collected stories in parallel. Stories are kept
  // past their 24h IG expiry on purpose so the feed can show the full
  // history a spot has ever posted.
  let spotsQuery = supabase
    .from('spots')
    .select('*')
    .order('created_at', { ascending: false });
  if (region) spotsQuery = spotsQuery.eq('region', region);
  if (category) spotsQuery = spotsQuery.eq('category', category);

  const storiesQuery = supabase
    .from('stories')
    .select('id, spot_id, instagram_id, media_url, media_type, thumbnail_url, posted_at, expires_at, scraped_at')
    .order('posted_at', { ascending: false });

  const [spotsRes, storiesRes] = await Promise.all([spotsQuery, storiesQuery]);

  if (spotsRes.error) {
    return NextResponse.json({ error: spotsRes.error.message }, { status: 500 });
  }
  if (storiesRes.error) {
    return NextResponse.json({ error: storiesRes.error.message }, { status: 500 });
  }

  const storiesBySpot = new Map<string, typeof storiesRes.data>();
  for (const s of storiesRes.data || []) {
    const arr = storiesBySpot.get(s.spot_id) ?? [];
    arr.push(s);
    storiesBySpot.set(s.spot_id, arr);
  }

  const spotsWithLatestStory = (spotsRes.data || []).map((spot) => {
    const stories = storiesBySpot.get(spot.id) || [];
    return {
      ...spot,
      stories,
      latest_story_at: stories[0]?.posted_at ?? null,
    };
  });

  return NextResponse.json(spotsWithLatestStory);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { data, error } = await supabase
    .from('spots')
    .insert([body])
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

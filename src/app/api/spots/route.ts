import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { Region, SpotCategory } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region') as Region | null;
  const category = searchParams.get('category') as SpotCategory | null;

  let query = supabase
    .from('spots')
    .select(`
      *,
      stories (
        id,
        spot_id,
        instagram_id,
        media_url,
        media_type,
        thumbnail_url,
        posted_at,
        expires_at,
        scraped_at
      )
    `)
    .order('created_at', { ascending: false });

  if (region) {
    query = query.eq('region', region);
  }
  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Add latest_story_at for each spot
  const spotsWithLatestStory = (data || []).map((spot) => {
    const stories = spot.stories || [];
    const now = new Date().toISOString();
    const activeStories = stories.filter(
      (s: { expires_at: string }) => s.expires_at > now
    );
    const latestStoryAt =
      activeStories.length > 0
        ? activeStories.reduce(
            (
              latest: string,
              s: { posted_at: string }
            ) => (s.posted_at > latest ? s.posted_at : latest),
            activeStories[0].posted_at
          )
        : null;

    return {
      ...spot,
      latest_story_at: latestStoryAt,
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

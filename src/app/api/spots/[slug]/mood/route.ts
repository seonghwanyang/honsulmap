import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import type { MoodVoteType } from '@/lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const body = await request.json();
  const { vote, fingerprint } = body as { vote: MoodVoteType; fingerprint: string };

  if (!fingerprint) {
    return NextResponse.json({ error: 'fingerprint가 필요합니다.' }, { status: 400 });
  }
  if (vote !== 'up' && vote !== 'down') {
    return NextResponse.json({ error: 'vote는 up 또는 down이어야 합니다.' }, { status: 400 });
  }

  // Look up spot by slug
  const { data: spot } = await supabase
    .from('spots')
    .select('id, mood_up, mood_down')
    .eq('slug', slug)
    .single();

  if (!spot) {
    return NextResponse.json({ error: '가게를 찾을 수 없습니다.' }, { status: 404 });
  }

  // Check existing vote
  const { data: existing } = await supabase
    .from('mood_votes')
    .select('id, vote')
    .eq('spot_id', spot.id)
    .eq('fingerprint', fingerprint)
    .single();

  let mood_up = spot.mood_up ?? 0;
  let mood_down = spot.mood_down ?? 0;

  if (existing) {
    if (existing.vote === vote) {
      // Same vote → cancel
      await supabase.from('mood_votes').delete().eq('id', existing.id);
      if (vote === 'up') mood_up = Math.max(0, mood_up - 1);
      else mood_down = Math.max(0, mood_down - 1);

      await supabase.from('spots').update({ mood_up, mood_down }).eq('id', spot.id);
      return NextResponse.json({ action: 'cancelled', mood_up, mood_down });
    } else {
      // Different vote → switch
      await supabase.from('mood_votes').update({ vote }).eq('id', existing.id);

      if (vote === 'up') {
        mood_up += 1;
        mood_down = Math.max(0, mood_down - 1);
      } else {
        mood_down += 1;
        mood_up = Math.max(0, mood_up - 1);
      }

      await supabase.from('spots').update({ mood_up, mood_down }).eq('id', spot.id);
      return NextResponse.json({ action: 'switched', mood_up, mood_down });
    }
  } else {
    // New vote
    const { error: insertError } = await supabase
      .from('mood_votes')
      .insert([{ spot_id: spot.id, vote, fingerprint }]);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    if (vote === 'up') mood_up += 1;
    else mood_down += 1;

    await supabase.from('spots').update({ mood_up, mood_down }).eq('id', spot.id);
    return NextResponse.json({ action: 'created', mood_up, mood_down });
  }
}

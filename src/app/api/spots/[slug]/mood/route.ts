import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { MoodVoteType } from '@/lib/types';

// One mood vote per fingerprint per spot. The client sends the button it
// pressed ('up' | 'down'); the server decides toggle/switch/cancel from
// the prior vote. Counts are recomputed from mood_votes every time so the
// denormalized mood_up/mood_down on spots can never drift — which is what
// inflated them before (the old path incremented on every click and, once
// a duplicate row slipped in, .single() kept failing and re-inserting).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const body = await request.json().catch(() => ({}));
  const { vote, fingerprint } = body as { vote: MoodVoteType; fingerprint: string };

  if (!fingerprint) {
    return NextResponse.json({ error: 'fingerprint가 필요합니다.' }, { status: 400 });
  }
  if (vote !== 'up' && vote !== 'down') {
    return NextResponse.json({ error: 'vote는 up 또는 down이어야 합니다.' }, { status: 400 });
  }

  const sb = supabaseAdmin();

  const { data: spot } = await sb
    .from('spots')
    .select('id')
    .eq('slug', slug)
    .single();
  if (!spot) {
    return NextResponse.json({ error: '가게를 찾을 수 없습니다.' }, { status: 404 });
  }

  // Read the prior vote (limit(1) guards against any pre-existing dupes),
  // then collapse every row for this (spot, fingerprint) to one source of
  // truth.
  const { data: prior } = await sb
    .from('mood_votes')
    .select('vote')
    .eq('spot_id', spot.id)
    .eq('fingerprint', fingerprint)
    .limit(1)
    .maybeSingle();

  await sb
    .from('mood_votes')
    .delete()
    .eq('spot_id', spot.id)
    .eq('fingerprint', fingerprint);

  // Pressing the same direction again clears the vote (toggle off).
  const myVote: MoodVoteType | null = prior?.vote === vote ? null : vote;
  if (myVote) {
    const { error: insertError } = await sb
      .from('mood_votes')
      .insert([{ spot_id: spot.id, vote: myVote, fingerprint }]);
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  // Recompute from the votes themselves — drift-proof.
  const { data: rows } = await sb
    .from('mood_votes')
    .select('vote')
    .eq('spot_id', spot.id);
  const mood_up = (rows ?? []).filter((r) => r.vote === 'up').length;
  const mood_down = (rows ?? []).filter((r) => r.vote === 'down').length;
  await sb.from('spots').update({ mood_up, mood_down }).eq('id', spot.id);

  return NextResponse.json({ mood_up, mood_down, vote: myVote });
}

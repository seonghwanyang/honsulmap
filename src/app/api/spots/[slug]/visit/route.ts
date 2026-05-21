import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Records one row in spot_visits per "다녀왔어요" tap and returns the
// updated total so the client can show it. No dedup: every tap counts,
// even from the same fingerprint.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let fingerprint: string | undefined;
  try {
    const body = await request.json();
    if (body && typeof body.fingerprint === 'string') {
      fingerprint = body.fingerprint;
    }
  } catch {
    // Empty / malformed body is fine — fingerprint stays undefined.
  }

  const { data: spot } = await supabase
    .from('spots')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (!spot) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const { error: insertError } = await supabase
    .from('spot_visits')
    .insert({ spot_id: spot.id, fingerprint: fingerprint ?? null });

  if (insertError) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const { count } = await supabase
    .from('spot_visits')
    .select('*', { count: 'exact', head: true })
    .eq('spot_id', spot.id);

  return NextResponse.json({ ok: true, count: count ?? 0 });
}

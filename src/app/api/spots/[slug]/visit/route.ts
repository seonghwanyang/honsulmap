import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Records one row in spot_visits per "다녀왔어요" tap and returns the
// updated total so the client can show it. No dedup: every tap counts,
// even from the same fingerprint.
//
// Service-role client: server-side event write, kept off the anon client
// so it can't silently break if an RLS policy drifts (see view/route.ts —
// the sibling spot_views write was exactly that bug).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const sb = supabaseAdmin();

  let fingerprint: string | undefined;
  try {
    const body = await request.json();
    if (body && typeof body.fingerprint === 'string') {
      fingerprint = body.fingerprint;
    }
  } catch {
    // Empty / malformed body is fine — fingerprint stays undefined.
  }

  const { data: spot } = await sb
    .from('spots')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (!spot) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const { error: insertError } = await sb
    .from('spot_visits')
    .insert({ spot_id: spot.id, fingerprint: fingerprint ?? null });

  if (insertError) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const { count } = await sb
    .from('spot_visits')
    .select('*', { count: 'exact', head: true })
    .eq('spot_id', spot.id);

  return NextResponse.json({ ok: true, count: count ?? 0 });
}

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Records one row in spot_views per call. Fire-and-forget from the
// client — we always return 200 so a failed insert doesn't surface as
// a noisy console error in the UI. No dedup: every panel open counts.
//
// Uses the service-role client. This is a server route; routing the
// insert through the anon client made view-recording silently depend on
// an RLS INSERT policy that was missing in the DB, so views never
// recorded (0 rows while visits accrued). The service role bypasses RLS
// and is immune to that policy drift.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const sb = supabaseAdmin();

  const { data: spot } = await sb
    .from('spots')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (!spot) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  await sb.from('spot_views').insert({ spot_id: spot.id });

  return NextResponse.json({ ok: true });
}

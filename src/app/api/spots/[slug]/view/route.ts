import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Records one row in spot_views per call. Fire-and-forget from the
// client — we always return 200 so a failed insert doesn't surface as
// a noisy console error in the UI. No dedup: every panel open counts.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  const { data: spot } = await supabase
    .from('spots')
    .select('id')
    .eq('slug', slug)
    .maybeSingle();

  if (!spot) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  await supabase.from('spot_views').insert({ spot_id: spot.id });

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

// Spot lookup for the claim flow — owner searches their venue by name or IG
// handle. Login-gated (whole /partner area is). spots are public data, so the
// service role read is fine here.
export async function GET(request: NextRequest) {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const raw = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  // Strip characters that would break the PostgREST or()/ilike filter syntax.
  const q = raw.replace(/[,()%_*]/g, ' ').trim();
  if (q.length < 2) return NextResponse.json({ spots: [] });

  const { data } = await supabaseAdmin()
    .from('spots')
    .select('id, name, slug, region, instagram_id')
    .or(`name.ilike.%${q}%,instagram_id.ilike.%${q}%`)
    .limit(10);

  return NextResponse.json({ spots: data ?? [] });
}

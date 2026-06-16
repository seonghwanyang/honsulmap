import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

// Dashboard payload for the logged-in owner: their approved memberships (with
// spot info) + any pending claims. Identity comes from the session cookie;
// the actual reads use the service role so RLS edge cases never hide a row.
export async function GET() {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = supabaseAdmin();
  const [{ data: spots }, { data: pendingClaims }] = await Promise.all([
    admin
      .from('spot_members')
      .select('role, spot:spots(id, name, slug, region, category, vip_until)')
      .eq('user_id', user.id),
    admin
      .from('spot_claims')
      .select('id, created_at, verification_code, spot:spots(name, slug)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  ]);

  return NextResponse.json({ spots: spots ?? [], pendingClaims: pendingClaims ?? [] });
}

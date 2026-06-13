import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Ownership claims submitted from the 사장님 센터 (partner portal). Behind admin
// basic-auth (middleware). Approving one (see [id]/route.ts) creates the
// spot_members row that unlocks the owner's dashboard.
export async function GET(request: NextRequest) {
  const status = new URL(request.url).searchParams.get('status');
  const admin = supabaseAdmin();

  let query = admin
    .from('spot_claims')
    .select(
      'id, spot_id, user_id, role, evidence, status, reviewer_note, created_at, reviewed_at, spot:spots(name, slug, region, instagram_id)',
    )
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Claimant email lives in auth.users (not joinable via PostgREST) — fetch it
  // per row so the operator can match the evidence to a person.
  const enriched = await Promise.all(
    (data ?? []).map(async (c) => {
      let user_email: string | null = null;
      try {
        const { data: u } = await admin.auth.admin.getUserById(c.user_id as string);
        user_email = u.user?.email ?? null;
      } catch {
        /* ignore — the row still shows, just without an email */
      }
      return { ...c, user_email };
    }),
  );

  return NextResponse.json(enriched);
}

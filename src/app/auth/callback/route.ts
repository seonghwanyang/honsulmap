import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

// OAuth callback: Kakao/Google redirect back here with a ?code. We exchange
// it for a session (writes the auth cookies), then bounce to wherever the
// user started (?next).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') || '/';

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : '/'}`);
    }
  }
  return NextResponse.redirect(`${origin}/?auth_error=1`);
}

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Server Supabase client (route handlers / server components). Used by the
// OAuth callback to exchange the code and write the session cookies.
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component (can't set cookies) — safe to
            // ignore; the callback route handler is where it actually writes.
          }
        },
      },
    },
  );
}

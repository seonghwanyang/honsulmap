import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// Browser Supabase client for AUTH (session lives in cookies via
// @supabase/ssr, so it persists across reloads/visits and auto-refreshes —
// the user never re-logs-in until they sign out). Memoized so the whole app
// shares one auth instance.
let client: SupabaseClient | undefined;

export function createBrowserSupabase(): SupabaseClient {
  if (client) return client;
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  return client;
}

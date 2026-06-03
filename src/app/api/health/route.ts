import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Lightweight health probe for uptime monitors (UptimeRobot). Returns 200
// only when the app can also reach the DB; 503 if the DB read fails or
// times out — so the monitor alerts on DB outages too, not just a fully
// dead site. Never cached.
export const dynamic = 'force-dynamic';

export async function GET() {
  const started = Date.now();
  let dbOk = false;
  try {
    const probe = supabase.from('spots').select('id').limit(1);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 4000),
    );
    const result = (await Promise.race([probe, timeout])) as { error: unknown };
    dbOk = !result.error;
  } catch {
    dbOk = false;
  }

  return NextResponse.json(
    {
      status: dbOk ? 'ok' : 'degraded',
      db: dbOk ? 'ok' : 'down',
      ms: Date.now() - started,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
    },
    {
      status: dbOk ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    },
  );
}

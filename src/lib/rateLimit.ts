import { supabaseAdmin } from '@/lib/supabase';

// Fixed-window rate limit backed by a Postgres function (see migration
// 2026-06-25_rate_limits.sql). Returns true if the request is allowed.
//
// Fails OPEN: if the limiter errors (function missing, DB hiccup) we allow the
// request rather than blocking legitimate traffic. The point is spam control,
// not a hard security boundary.
export async function rateLimit(
  bucket: string,
  identifier: string,
  windowSec: number,
  max: number,
): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin().rpc('rate_limit_hit', {
      p_bucket: bucket,
      p_identifier: identifier,
      p_window_sec: windowSec,
      p_max: max,
    });
    if (error) return true; // fail open
    return data === true;
  } catch {
    return true; // fail open
  }
}

// Best-effort client IP from Vercel's forwarding headers. Falls back to a
// constant so a missing header buckets everyone together (still rate-limited,
// just shared) rather than throwing.
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

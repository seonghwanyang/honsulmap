import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export type UserSpotEventType =
  | 'view'
  | 'story_play'
  | 'story_complete'
  | 'visit'
  | 'like'
  | 'unlike'
  | 'mood_up'
  | 'mood_down'
  | 'mood_clear'
  | 'ig_click'
  | 'checkin_pass'
  | 'checkin_fail'
  | 'search';

// Fire-and-forget per-user behavior log. Records nothing for anonymous
// visitors (user_spot_events.user_id is NOT NULL) — their counts still land in
// spot_views/spot_visits as before. NEVER throws: a logging failure must not
// break the underlying action (a view/visit/like must still succeed).
export async function logUserSpotEvent(
  eventType: UserSpotEventType,
  spotId: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    const sb = await createServerSupabase();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return;
    await supabaseAdmin().from('user_spot_events').insert({
      user_id: user.id,
      spot_id: spotId,
      event_type: eventType,
      meta: meta ?? null,
    });
  } catch {
    /* best-effort analytics — ignore */
  }
}

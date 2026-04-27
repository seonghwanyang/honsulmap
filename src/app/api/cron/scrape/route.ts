import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

const BATCH_SIZE = 15;
const IG_APP_ID = '936619743392459';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function igCookie() {
  return [
    `sessionid=${process.env.IG_SESSION_ID}`,
    `csrftoken=${process.env.IG_CSRF_TOKEN}`,
    `ds_user_id=${process.env.IG_DS_USER_ID}`,
    process.env.IG_DID ? `ig_did=${process.env.IG_DID}` : '',
    process.env.IG_MID ? `mid=${process.env.IG_MID}` : '',
  ].filter(Boolean).join('; ');
}

function igHeaders() {
  return {
    'x-ig-app-id': IG_APP_ID,
    'x-asbd-id': '359341',
    'x-csrftoken': process.env.IG_CSRF_TOKEN!,
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
    'origin': 'https://www.instagram.com',
    'referer': 'https://www.instagram.com/',
    'cookie': igCookie(),
  };
}

interface StoryRecord {
  instagram_media_id: string;
  instagram_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  thumbnail_url: string | null;
  posted_at: string;
  expires_at: string;
  scraped_at: string;
}

async function fetchStories(userId: string, igId: string, headers: Record<string, string>): Promise<StoryRecord[]> {
  const res = await fetch(
    `https://i.instagram.com/api/v1/feed/reels_media/?reel_ids=${userId}`,
    { headers },
  );

  if (!res.ok) return [];

  const data = await res.json();
  const items = data?.reels?.[userId]?.items || [];
  const now = Date.now();
  const stories: StoryRecord[] = [];

  for (const item of items) {
    const takenAt = item.taken_at * 1000;
    const expiresAt = takenAt + 24 * 60 * 60 * 1000;

    if (now > expiresAt) continue;

    let mediaUrl: string;
    let mediaType: 'image' | 'video';
    let thumbnailUrl: string | null = null;

    if (item.video_versions) {
      mediaUrl = item.video_versions[0].url;
      mediaType = 'video';
      thumbnailUrl = item.image_versions2?.candidates?.[0]?.url || null;
    } else {
      const candidates = item.image_versions2?.candidates || [];
      if (!candidates.length) continue;
      mediaUrl = candidates[0].url;
      mediaType = 'image';
    }

    stories.push({
      instagram_media_id: String(item.pk),
      instagram_id: igId,
      media_url: mediaUrl,
      media_type: mediaType,
      thumbnail_url: thumbnailUrl,
      posted_at: new Date(takenAt).toISOString(),
      expires_at: new Date(expiresAt).toISOString(),
      scraped_at: new Date().toISOString(),
    });
  }

  return stories;
}

async function checkIgSession(headers: Record<string, string>) {
  // Probe against an auth-required profile endpoint. Earlier we hit
  // the reels feed for @instagram, but if @instagram simply hasn't
  // posted a story today the response is `{reels:{},status:"ok"}` —
  // identical to what an unauthenticated session sees, so we kept
  // false-flagging live sessions as dead. web_profile_info returns
  // a populated `data.user` only when cookies are valid.
  try {
    const res = await fetch(
      'https://i.instagram.com/api/v1/users/web_profile_info/?username=instagram',
      { headers },
    );
    if (!res.ok) {
      const snippet = (await res.text().catch(() => '')).slice(0, 200);
      return { alive: false, status: res.status, snippet };
    }
    const data = await res.json().catch(() => null);
    const userId = data?.data?.user?.id;
    if (!userId) {
      return {
        alive: false,
        status: res.status,
        snippet: 'profile_info returned no user (session likely expired)',
      };
    }
    return { alive: true, status: res.status };
  } catch (e) {
    return { alive: false, status: 0, error: (e as Error).message };
  }
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.warn('[cron/scrape] Unauthorized call', { hasHeader: !!authHeader });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Surface missing IG env early so a redeploy isn't needed to diagnose
  const missingEnv = ['IG_SESSION_ID', 'IG_CSRF_TOKEN', 'IG_DS_USER_ID', 'SUPABASE_SERVICE_ROLE_KEY']
    .filter((k) => !process.env[k]);
  if (missingEnv.length) {
    console.error('[cron/scrape] Missing env', { missing: missingEnv });
    return NextResponse.json({ error: 'Missing env', missing: missingEnv }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();
  const headers = igHeaders();

  const session = await checkIgSession(headers);
  console.log('[cron/scrape] session', session);
  if (!session.alive) {
    return NextResponse.json(
      {
        error: 'IG session dead — refresh IG_SESSION_ID / IG_CSRF_TOKEN / IG_DS_USER_ID cookies',
        session,
      },
      { status: 502 },
    );
  }

  const sessionUserId: string | null = null;

  // Stories are kept past their 24h expiry on purpose so the feed can
  // show the full history a spot has ever posted. No cleanup here.

  // Get spots with cached user_id, oldest-scraped first
  const { data: spots } = await supabase
    .from('spots')
    .select('id, name, instagram_id, instagram_user_id, last_scraped_at')
    .not('instagram_id', 'is', null)
    .neq('instagram_id', '')
    .not('instagram_user_id', 'is', null)
    .order('last_scraped_at', { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE);

  if (!spots?.length) {
    return NextResponse.json({ message: 'No spots to process', processed: 0 });
  }

  let totalStories = 0;
  let errors = 0;

  for (const spot of spots) {
    try {
      const stories = await fetchStories(spot.instagram_user_id, spot.instagram_id, headers);

      for (const story of stories) {
        const { error } = await supabase
          .from('stories')
          .upsert(
            { spot_id: spot.id, ...story },
            { onConflict: 'instagram_media_id' },
          );
        if (!error) totalStories++;
      }
    } catch {
      errors++;
    }

    await supabase
      .from('spots')
      .update({ last_scraped_at: new Date().toISOString() })
      .eq('id', spot.id);

    // 1s delay between spots to avoid rate limit
    await new Promise((r) => setTimeout(r, 1000));
  }

  const elapsedMs = Date.now() - startedAt;
  console.log('[cron/scrape] done', {
    processed: spots.length,
    stories: totalStories,
    errors,
    elapsedMs,
  });

  return NextResponse.json({
    processed: spots.length,
    stories: totalStories,
    errors,
    elapsedMs,
    sessionUserId,
  });
}

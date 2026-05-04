/**
 * Cache Instagram numeric user IDs for guesthouse spots.
 *
 * Selects guesthouse spots WHERE instagram_id IS NOT NULL AND
 * instagram_user_id IS NULL, then resolves each handle via IG's
 * web_profile_info endpoint and writes the numeric id back.
 *
 * Pace: 1 request/second.
 *
 * Usage: npx tsx scripts/cache_gh_user_ids.ts
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const IG_APP_ID = '936619743392459';

function cookie(): string {
  return [
    `sessionid=${process.env.IG_SESSION_ID}`,
    `csrftoken=${process.env.IG_CSRF_TOKEN}`,
    `ds_user_id=${process.env.IG_DS_USER_ID}`,
    process.env.IG_DID ? `ig_did=${process.env.IG_DID}` : '',
    process.env.IG_MID ? `mid=${process.env.IG_MID}` : '',
  ]
    .filter(Boolean)
    .join('; ');
}

async function resolveUserId(handle: string): Promise<
  | { ok: true; id: string }
  | { ok: false; status: 'not_found' | 'private_or_blocked' | 'error'; detail: string }
> {
  try {
    const res = await fetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`,
      {
        headers: {
          'x-ig-app-id': IG_APP_ID,
          'x-asbd-id': '359341',
          'x-csrftoken': process.env.IG_CSRF_TOKEN ?? '',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
          origin: 'https://www.instagram.com',
          referer: `https://www.instagram.com/${handle}/`,
          cookie: cookie(),
        },
      },
    );
    if (res.status === 404) {
      return { ok: false, status: 'not_found', detail: 'HTTP 404' };
    }
    if (!res.ok) {
      return { ok: false, status: 'error', detail: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { data?: { user?: { id?: string } } };
    const id = data?.data?.user?.id;
    if (!id) {
      return { ok: false, status: 'private_or_blocked', detail: 'no user.id in payload' };
    }
    return { ok: true, id: String(id) };
  } catch (err) {
    return { ok: false, status: 'error', detail: String(err) };
  }
}

interface SpotRow {
  id: string;
  name: string;
  instagram_id: string;
}

(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing Supabase env vars');
    process.exit(1);
  }
  if (
    !process.env.IG_SESSION_ID ||
    !process.env.IG_CSRF_TOKEN ||
    !process.env.IG_DS_USER_ID
  ) {
    console.error('Missing IG_SESSION_ID / IG_CSRF_TOKEN / IG_DS_USER_ID in .env.local');
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await sb
    .from('spots')
    .select('id, name, instagram_id')
    .eq('category', 'guesthouse')
    .not('instagram_id', 'is', null)
    .is('instagram_user_id', null);

  if (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }

  const targets = (data ?? []) as SpotRow[];
  console.log(`Found ${targets.length} guesthouse spots needing user_id resolution`);

  let cached = 0;
  let notFound = 0;
  let errors = 0;

  for (let i = 0; i < targets.length; i++) {
    const sp = targets[i];
    const handle = sp.instagram_id;
    const result = await resolveUserId(handle);
    if (result.ok) {
      const { error: upErr } = await sb
        .from('spots')
        .update({ instagram_user_id: result.id })
        .eq('id', sp.id);
      if (upErr) {
        console.log(`  [${i + 1}/${targets.length}] ${handle}  →  error (update: ${upErr.message})`);
        errors++;
      } else {
        console.log(`  [${i + 1}/${targets.length}] ${handle}  →  cached id=${result.id}`);
        cached++;
      }
    } else if (result.status === 'not_found') {
      console.log(`  [${i + 1}/${targets.length}] ${handle}  →  not_found`);
      notFound++;
    } else {
      console.log(
        `  [${i + 1}/${targets.length}] ${handle}  →  ${result.status} (${result.detail})`,
      );
      errors++;
    }
    // Pace ~1 req/sec to avoid rate limits.
    if (i < targets.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log('\n──────────── Summary ────────────');
  console.log(`cached=${cached} not_found=${notFound} errors=${errors}`);
})();

/**
 * Weekly signup-retention cohorts from Supabase auth.users.
 *
 * GA4 cohorts are anonymous + auto-labeled (cohort 0001…) and can't tie to our
 * users. This reads the real auth users instead: groups by ISO signup week and
 * reports how many returned (signed in again >1 day after signup).
 *
 * Usage: npx tsx scripts/retention_cohort.ts
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

function isoWeek(iso: string): string {
  const d = new Date(iso);
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const week1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const wk = 1 + Math.round(((t.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
  return `${t.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}

(async () => {
  const users: { created_at: string; last_sign_in_at: string | null; app_metadata?: { provider?: string } }[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error('listUsers error:', error.message);
      process.exit(1);
    }
    users.push(...(data.users as typeof users));
    if (data.users.length < 1000) break;
    page++;
  }

  const now = Date.now();
  const within = (u: (typeof users)[number], days: number) => now - new Date(u.created_at).getTime() < days * 864e5;
  const returned = (u: (typeof users)[number]) =>
    !!u.last_sign_in_at && new Date(u.last_sign_in_at).getTime() - new Date(u.created_at).getTime() > 864e5;

  const cohort: Record<string, { signups: number; returned: number }> = {};
  const prov: Record<string, number> = {};
  let totalReturned = 0;
  for (const u of users) {
    const wk = isoWeek(u.created_at);
    (cohort[wk] ??= { signups: 0, returned: 0 }).signups++;
    if (returned(u)) {
      cohort[wk].returned++;
      totalReturned++;
    }
    const p = u.app_metadata?.provider ?? '?';
    prov[p] = (prov[p] ?? 0) + 1;
  }

  console.log(`총 가입: ${users.length} | 최근 7일: ${users.filter((u) => within(u, 7)).length} | 30일: ${users.filter((u) => within(u, 30)).length}`);
  console.log(`전체 재방문율(가입 후 1일+ 뒤 재로그인): ${totalReturned}/${users.length} = ${Math.round((totalReturned / Math.max(users.length, 1)) * 100)}%`);
  console.log('provider:', prov);
  console.log('\n주차별 가입 코호트 (가입 / 재방문 / 재방문율):');
  for (const wk of Object.keys(cohort).sort()) {
    const c = cohort[wk];
    console.log(`  ${wk}:  ${String(c.signups).padStart(4)} / ${String(c.returned).padStart(3)} / ${Math.round((c.returned / c.signups) * 100)}%`);
  }
})();

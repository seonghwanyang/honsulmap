import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

(async () => {
  const now = Date.now();

  const { data: spots } = await s
    .from('spots')
    .select('name, last_scraped_at')
    .not('last_scraped_at', 'is', null)
    .order('last_scraped_at', { ascending: false })
    .limit(5);

  const { count: storyCount } = await s
    .from('stories')
    .select('*', { count: 'exact', head: true });

  const { data: recentStories } = await s
    .from('stories')
    .select('posted_at, scraped_at, spot_id')
    .order('scraped_at', { ascending: false })
    .limit(3);

  const latest = spots?.[0]?.last_scraped_at ? new Date(spots[0].last_scraped_at).getTime() : 0;
  const mins = latest ? Math.round((now - latest) / 60_000) : null;

  console.log('\n=== Cron health ===');
  console.log('Active stories in DB:', storyCount ?? 0);
  console.log('Most recent scrape (any spot):', mins === null ? 'NEVER' : `${mins} minutes ago`);
  if (mins !== null) {
    if (mins < 10) console.log('→ 정상: 크론이 최근에 돌았음');
    else if (mins < 60) console.log('→ 주의: 1시간 내에 돌긴 했는데 최근은 아님');
    else console.log('→ 🚨 문제: 1시간 이상 크론이 안 돎');
  }
  console.log('\nTop 5 recently-scraped spots:');
  spots?.forEach((sp) => {
    const m = Math.round((now - new Date(sp.last_scraped_at).getTime()) / 60_000);
    console.log(`  ${sp.name.padEnd(20)} ${m} min ago`);
  });
  if (recentStories?.length) {
    console.log('\nRecent story inserts:');
    recentStories.forEach((r) => {
      console.log(`  posted ${r.posted_at} | scraped ${r.scraped_at}`);
    });
  }
})();

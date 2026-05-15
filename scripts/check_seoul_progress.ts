import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

(async () => {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data } = await sb
    .from('spots')
    .select('name, region, naver_place_id, lat, lng')
    .eq('city', 'seoul')
    .order('created_at', { ascending: true });
  const total = data?.length ?? 0;
  const withPlace = (data ?? []).filter((r: any) => r.naver_place_id).length;
  const missing = (data ?? []).filter((r: any) => !r.naver_place_id);
  console.log(`Seoul total: ${total}`);
  console.log(`with naver_place_id: ${withPlace}`);
  console.log(`missing naver_place_id: ${missing.length}`);
  if (missing.length > 0) {
    console.log('\nMissing:');
    missing.forEach((r: any) => console.log(`  - ${r.name} (${r.region})`));
  }
})();

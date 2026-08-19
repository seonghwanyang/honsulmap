// 테이블 서비스 E2E 스모크 시드/정리 (janzan-jeju).
// node scripts/_seed_table_test_2026-08-19.mjs seed | cleanup
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const SLUG = 'janzan-jeju';
const mode = process.argv[2] ?? 'seed';

const { data: spot } = await sb.from('spots').select('id, name').eq('slug', SLUG).single();
if (!spot) { console.log('spot not found'); process.exit(1); }

if (mode === 'cleanup') {
  await sb.from('table_orders').delete().eq('spot_id', spot.id);
  await sb.from('table_sessions').delete().eq('spot_id', spot.id);
  await sb.from('store_zones').delete().eq('spot_id', spot.id);
  await sb.from('store_menu_categories').delete().eq('spot_id', spot.id);
  await sb.from('store_table_config').delete().eq('spot_id', spot.id);
  console.log('CLEANED', spot.name);
  process.exit(0);
}

await sb.from('store_table_config').upsert({ spot_id: spot.id, enabled: true, live_status: 'busy' }, { onConflict: 'spot_id' });

const { data: zone } = await sb.from('store_zones').insert({ spot_id: spot.id, name: '바석', grid_rows: 2, grid_cols: 5, sort: 0 }).select('id').single();
const seats = [];
for (let c = 0; c < 5; c++) seats.push({ zone_id: zone.id, spot_id: spot.id, label: String(c + 1), row: 0, col: c, seat_type: 'seat' });
seats.push({ zone_id: zone.id, spot_id: spot.id, label: '테이블', row: 1, col: 2, seat_type: 'block' });
await sb.from('store_seats').insert(seats);

const { data: cat } = await sb.from('store_menu_categories').insert({ spot_id: spot.id, name: '테스트', sort: 0 }).select('id').single();
const { data: items } = await sb.from('store_menu_items').insert([
  { category_id: cat.id, spot_id: spot.id, name: '하이볼', price: 8000, sort: 0 },
  { category_id: cat.id, spot_id: spot.id, name: '직원 호출', price: 0, zero_action: 'call', sort: 1 },
]).select('id, name');

console.log('SEEDED', spot.name, '| items:', items.map(i => `${i.name}=${i.id}`).join(' '));

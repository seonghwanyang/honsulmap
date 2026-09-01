// 좌석 QR 토큰 강제 토글 — 새 토큰 스티커가 매장에 부착된 뒤에만 켤 것!
// (구형 무토큰 QR이 즉시 죽는다) 사용: node scripts/_set_qr_token_required.mjs [on|off]
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const SPOT = '43a6e530-3954-4c5a-bc9f-272894d12033'; // 더끌림 수원인계점

const on = process.argv[2] === 'on';
if (!['on', 'off'].includes(process.argv[2] ?? '')) throw new Error('사용법: node scripts/_set_qr_token_required.mjs on|off');

const { data: cfg } = await sb.from('store_table_config').select('modes').eq('spot_id', SPOT).single();
await sb
  .from('store_table_config')
  .update({ modes: { ...(cfg.modes ?? {}), qr_token_required: on } })
  .eq('spot_id', SPOT);
const { data: after } = await sb.from('store_table_config').select('modes').eq('spot_id', SPOT).single();
console.log('qr_token_required =', after.modes.qr_token_required);

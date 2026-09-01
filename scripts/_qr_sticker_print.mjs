// 인쇄소 입고용 스티커 HTML 생성 — 더끌림 전 좌석, 낱장(페이지당 1매).
// 재단 5.2×6.0cm + 블리드 2mm = 작업 5.6×6.4cm. 배경은 블리드까지 풀커버(라운드 없음
// — 모서리 라운드는 인쇄소 도무송 옵션으로), 내용은 재단선 안쪽 안전영역에 배치.
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', quiet: true });
import { writeFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import QRCode from 'qrcode';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const SPOT = '43a6e530-3954-4c5a-bc9f-272894d12033';

const { data: spot } = await sb.from('spots').select('name, slug').eq('id', SPOT).single();
const { data: seats } = await sb
  .from('store_seats')
  .select('label, seat_type')
  .eq('spot_id', SPOT)
  .eq('active', true)
  .neq('seat_type', 'block');
const labels = [...new Set((seats ?? []).map((s) => s.label))].sort((a, b) =>
  a.localeCompare(b, 'ko', { numeric: true }),
);
console.log(`${spot.name} — 좌석 ${labels.length}개:`, labels.join(','));

// 좌석 서명 토큰 — src/lib/seatToken.ts와 동일 계산 (스캔=인증)
const SECRET = process.env.SEAT_QR_SECRET;
if (!SECRET) throw new Error('SEAT_QR_SECRET가 .env.local에 없습니다');
const token = (label) => createHmac('sha256', SECRET).update(`${SPOT}:${label}`).digest('hex').slice(0, 8);

const pages = [];
for (const label of labels) {
  const url = `https://honsulmap.com/t/${encodeURIComponent(spot.slug)}?seat=${encodeURIComponent(label)}&k=${token(label)}`;
  const qr = await QRCode.toDataURL(url, { width: 800, margin: 1, color: { dark: '#111827', light: '#ffffff' } });
  pages.push(`
  <div class="page">
    <div class="inner">
      <div class="name">${spot.name}</div>
      <div class="qrbox"><img src="${qr}"></div>
      <div class="seatrow"><span class="line"></span><span class="seat serif">SEAT ${label}</span><span class="line"></span></div>
      <div class="foot">혼술맵</div>
    </div>
  </div>`);
}

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: 5.6cm 6.4cm; margin: 0; }
  .serif { font-family: Georgia, 'Times New Roman', serif; }
  .page {
    width: 5.6cm; height: 6.4cm; page-break-after: always; overflow: hidden;
    background: radial-gradient(130% 100% at 18% 0%, rgba(255,236,210,0.13) 0%, rgba(255,236,210,0) 55%),
                radial-gradient(120% 85% at 50% 0%, #1b1b1f 0%, #0c0c0e 100%);
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
  }
  /* 재단선(5.2×6.0) 안쪽 + 안전여백 — 내용 폭 4.6cm */
  .inner { width: 4.6cm; text-align: center; display: flex; flex-direction: column; align-items: center; }
  .name { font-size: 0.37cm; font-weight: 800; color: #fff; letter-spacing: -0.01cm; }
  .qrbox { background: #fff; border-radius: 0.21cm; padding: 0.16cm; margin-top: 0.21cm; box-shadow: 0 0 0 0.04cm #EAB308; }
  .qrbox img { width: 3.2cm; height: 3.2cm; display: block; }
  .seatrow { display: flex; align-items: center; gap: 0.21cm; margin-top: 0.24cm; }
  .line { width: 0.4cm; height: 1px; background: rgba(255,255,255,0.22); }
  .seat { font-size: 0.34cm; letter-spacing: 0.1cm; color: #EAB308; }
  .foot { font-size: 0.22cm; letter-spacing: 0.08cm; color: rgba(255,255,255,0.42); margin-top: 0.16cm; font-weight: 700; }
</style></head><body>${pages.join('')}</body></html>`;

writeFileSync('brand_asset/_qr_stickers_print.html', html);
console.log(`입고용 HTML 생성 — ${labels.length}페이지 (작업 5.6×6.4cm, 재단 5.2×6.0cm)`);

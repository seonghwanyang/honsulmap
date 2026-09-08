import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// 스크래퍼(갤탭) 감시 — 과정이 아니라 결과를 본다. spots.last_scraped_at 최신값이
// SCRAPER_STALE_MIN(기본 5분)보다 오래되면 503. UptimeRobot이 5분마다 이 주소를 보고 실패하면 메일.
//
// last_scraped_at은 가게 하나를 시도할 때마다 갱신된다(스토리 유무·성공 여부 무관). 정상 운전 중엔
// 몇십 초마다 움직이고, 사이클 사이 공백(30초 대기 + 브라우저 부팅 30~60초)이 길어야 2분쯤이라
// 5분이면 여유가 있다. 갤탭이 꺼졌든 와이파이가 끊겼든 storysaver가 막혔든 전부 여기서 잡힌다.
// 임계값을 바꾸려면 Vercel env SCRAPER_STALE_MIN. 절대 캐시하지 않는다.
export const dynamic = 'force-dynamic';

export async function GET() {
  const thresholdMin = Number(process.env.SCRAPER_STALE_MIN ?? 5);
  const { data, error } = await supabaseAdmin()
    .from('spots')
    .select('last_scraped_at')
    .not('last_scraped_at', 'is', null)
    .order('last_scraped_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastMs = data?.last_scraped_at ? Date.parse(data.last_scraped_at) : NaN;
  const ageSec = Number.isFinite(lastMs) ? Math.round((Date.now() - lastMs) / 1000) : null;
  const ok = !error && ageSec !== null && ageSec <= thresholdMin * 60;

  return NextResponse.json(
    {
      status: ok ? 'ok' : 'stale',
      last_scraped_at: data?.last_scraped_at ?? null,
      age_sec: ageSec,
      threshold_min: thresholdMin,
      ...(error ? { db: error.message } : {}),
    },
    {
      status: ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    },
  );
}

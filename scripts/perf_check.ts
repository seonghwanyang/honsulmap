/**
 * Page + API response time probe.
 *
 * Run the dev server first (`npm run dev`), then:
 *   npx tsx scripts/perf_check.ts
 * Or against production:
 *   BASE_URL=https://your-domain npx tsx scripts/perf_check.ts
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const RUNS = Number(process.env.RUNS || 3);

interface Target {
  kind: 'page' | 'api';
  path: string;
  label: string;
}

const TARGETS: Target[] = [
  { kind: 'page', path: '/', label: 'map' },
  { kind: 'page', path: '/feed', label: 'feed' },
  { kind: 'page', path: '/community', label: 'community' },
  { kind: 'page', path: '/write', label: 'write' },
  { kind: 'api', path: '/api/spots', label: 'spots' },
  { kind: 'api', path: '/api/stories/latest', label: 'stories-latest' },
  { kind: 'api', path: '/api/posts?limit=20', label: 'posts-list' },
  { kind: 'api', path: '/api/posts/popular', label: 'posts-popular' },
];

interface Sample {
  status: number;
  ttfbMs: number;
  totalMs: number;
  bytes: number;
}

async function probe(url: string): Promise<Sample> {
  const t0 = performance.now();
  const res = await fetch(url, { cache: 'no-store' });
  const reader = res.body?.getReader();
  let bytes = 0;
  let ttfbMs = performance.now() - t0;

  if (reader) {
    // First read marks TTFB more accurately
    const first = await reader.read();
    ttfbMs = performance.now() - t0;
    if (first.value) bytes += first.value.length;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) bytes += value.length;
    }
  }
  const totalMs = performance.now() - t0;
  return { status: res.status, ttfbMs, totalMs, bytes };
}

function pct(xs: number[], p: number) {
  const sorted = [...xs].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

function fmt(n: number, pad = 6) {
  return n.toFixed(0).padStart(pad);
}

async function warmup() {
  try { await fetch(`${BASE}/`, { cache: 'no-store' }); } catch {}
}

async function run() {
  console.log(`Base: ${BASE}  Runs/target: ${RUNS}`);
  console.log();
  console.log('                                  TTFB ms             Total ms');
  console.log('kind  label            status    min  p50  max      min  p50  max     size');
  console.log('----  ---------------  ------  ----  ---  ----    ----  ---  ----  -------');

  await warmup();

  const rows: Array<{ t: Target; s: Sample[] }> = [];
  for (const t of TARGETS) {
    const samples: Sample[] = [];
    for (let i = 0; i < RUNS; i++) {
      try {
        const s = await probe(`${BASE}${t.path}`);
        samples.push(s);
      } catch (e) {
        console.log(`${t.kind}  ${t.label.padEnd(15)}  ERROR  ${(e as Error).message}`);
      }
    }
    rows.push({ t, s: samples });
  }

  for (const { t, s } of rows) {
    if (!s.length) continue;
    const ttfb = s.map((x) => x.ttfbMs);
    const total = s.map((x) => x.totalMs);
    const size = s[0].bytes;
    console.log(
      `${t.kind.padEnd(4)}  ${t.label.padEnd(15)}  ${String(s[0].status).padEnd(6)}` +
      `${fmt(Math.min(...ttfb), 6)} ${fmt(pct(ttfb, 50), 4)} ${fmt(Math.max(...ttfb), 5)}   ` +
      `${fmt(Math.min(...total), 5)} ${fmt(pct(total, 50), 4)} ${fmt(Math.max(...total), 5)}  ` +
      `${(size / 1024).toFixed(1).padStart(5)}K`,
    );
  }

  console.log();
  console.log('Slowest by p50 TTFB:');
  rows
    .filter((r) => r.s.length)
    .map((r) => ({ label: r.t.label, p50: pct(r.s.map((x) => x.ttfbMs), 50) }))
    .sort((a, b) => b.p50 - a.p50)
    .slice(0, 5)
    .forEach((r) => console.log(`  ${r.label.padEnd(15)} ${r.p50.toFixed(0)} ms`));
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

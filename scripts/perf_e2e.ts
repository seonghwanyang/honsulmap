/**
 * Simulates what a browser actually does on navigation:
 *   1. GET the page HTML
 *   2. Parse out JS/CSS/font URLs from the HTML
 *   3. Fetch all those static assets in parallel (like a browser)
 *   4. Fire the client-side data fetches the page triggers (useEffect)
 * Prints per-phase timing so you can see whether bundle download,
 * hydration data, or waterfall is the bottleneck.
 *
 *   npx tsx scripts/perf_e2e.ts
 */

const BASE = process.env.BASE_URL || 'http://localhost:3000';

interface Scenario {
  label: string;
  path: string;
  dataFetches: string[];
}

// dataFetches is what the BROWSER fetches AFTER the HTML arrives. For RSC
// pages the initial data is embedded in HTML so no client fetch happens.
const SCENARIOS: Scenario[] = [
  { label: 'map', path: '/', dataFetches: ['/api/spots'] },
  { label: 'feed', path: '/feed', dataFetches: [] },
  { label: 'community', path: '/community', dataFetches: [] },
  { label: 'write', path: '/write', dataFetches: [] },
];

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = performance.now();
  const v = await fn();
  return [v, performance.now() - t0];
}

async function fetchBytes(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  const buf = await res.arrayBuffer();
  return { status: res.status, bytes: buf.byteLength };
}

function extractAssets(html: string): string[] {
  const urls = new Set<string>();
  const scriptRe = /<script[^>]+src="([^"]+)"/g;
  const linkRe = /<link[^>]+href="([^"]+)"[^>]*(?:rel="stylesheet"|as="font"|as="script")/g;
  const m1 = html.matchAll(scriptRe);
  for (const m of m1) urls.add(m[1]);
  const m2 = html.matchAll(linkRe);
  for (const m of m2) urls.add(m[1]);
  return [...urls].filter((u) => u.startsWith('/_next') || u.startsWith('http'));
}

async function run(scenario: Scenario) {
  console.log(`\n━━━ /${scenario.label.replace('map', '')} ━━━`);

  const [htmlRes, htmlMs] = await timed(async () => {
    const r = await fetch(`${BASE}${scenario.path}`, { cache: 'no-store' });
    const t = await r.text();
    return { status: r.status, bytes: t.length, html: t };
  });
  console.log(`  HTML           ${htmlMs.toFixed(0).padStart(5)} ms  ${(htmlRes.bytes / 1024).toFixed(1)} KB  (${htmlRes.status})`);

  const assets = extractAssets(htmlRes.html);
  console.log(`  Assets found   ${assets.length}`);

  const [assetResults, assetsMs] = await timed(async () => {
    return Promise.all(
      assets.map((u) =>
        fetchBytes(u.startsWith('http') ? u : `${BASE}${u}`).catch(() => ({ status: 0, bytes: 0 })),
      ),
    );
  });
  const totalBytes = assetResults.reduce((s, r) => s + r.bytes, 0);
  console.log(`  Assets parallel ${assetsMs.toFixed(0).padStart(4)} ms  ${(totalBytes / 1024).toFixed(1)} KB`);

  let dataMs = 0;
  let dataBytes = 0;
  if (scenario.dataFetches.length) {
    const [dataResults, dMs] = await timed(async () => {
      return Promise.all(
        scenario.dataFetches.map((u) => fetchBytes(`${BASE}${u}`)),
      );
    });
    dataMs = dMs;
    dataBytes = dataResults.reduce((s, r) => s + r.bytes, 0);
    console.log(`  Client data    ${dataMs.toFixed(0).padStart(5)} ms  ${(dataBytes / 1024).toFixed(1)} KB  (${scenario.dataFetches.join(', ')})`);
  }

  // Realistic waterfall: HTML → (assets parallel + React hydration) → data
  // Browser hydration runs while assets are downloading, then data fetch starts
  const perceived = htmlMs + Math.max(assetsMs, 0) + dataMs;
  console.log(`  ≈ Perceived    ${perceived.toFixed(0)} ms  (HTML + assets + data waterfall)`);

  return { label: scenario.label, htmlMs, assetsMs, dataMs, perceived, assetBytes: totalBytes };
}

(async () => {
  console.log(`Base: ${BASE}`);
  // Warm up all routes so dev-mode compilation cost is removed
  for (const s of SCENARIOS) {
    await fetch(`${BASE}${s.path}`, { cache: 'no-store' }).catch(() => {});
  }

  console.log('\n=== Measured (after warmup) ===');
  const results = [];
  for (const s of SCENARIOS) {
    results.push(await run(s));
  }

  console.log('\n=== Summary ===');
  console.log('label       html   assets   data   perceived   bundle');
  for (const r of results) {
    console.log(
      `${r.label.padEnd(10)}  ${r.htmlMs.toFixed(0).padStart(4)}   ${r.assetsMs.toFixed(0).padStart(4)}   ${r.dataMs.toFixed(0).padStart(4)}     ${r.perceived.toFixed(0).padStart(5)}    ${(r.assetBytes / 1024).toFixed(0)}K`,
    );
  }
})();

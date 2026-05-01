export {};

const PLACE_ID = '36772248'; // 미친부엌

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  Accept: 'application/json, text/html;q=0.9, */*;q=0.8',
  Referer: 'https://m.place.naver.com/',
  'apollo-require-preflight': 'true',
};

async function probe(url: string, headers: Record<string, string> = HEADERS) {
  try {
    const res = await fetch(url, { headers });
    const text = await res.text();
    const ct = res.headers.get('content-type') || '';
    return {
      url,
      status: res.status,
      contentType: ct,
      length: text.length,
      preview: text.slice(0, 800).replace(/\s+/g, ' '),
    };
  } catch (e) {
    return { url, error: (e as Error).message };
  }
}

(async () => {
  // 1) m.place page — already proven 200, peek at the embedded data
  const home = await fetch(`https://m.place.naver.com/restaurant/${PLACE_ID}/home`, {
    headers: HEADERS,
  });
  const homeHtml = await home.text();
  // Naver's place page embeds initial data in <script id="__APOLLO_STATE__">
  const apolloMatch = homeHtml.match(/window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\});/);
  if (apolloMatch) {
    const json = JSON.parse(apolloMatch[1]);
    console.log('APOLLO_STATE keys count:', Object.keys(json).length);

    // Find the PlaceDetailBase — main object
    const baseKey = `PlaceDetailBase:${PLACE_ID}`;
    if (json[baseKey]) {
      console.log(`\n=== ${baseKey} ===`);
      const base = json[baseKey];
      console.log(JSON.stringify(base, null, 2).slice(0, 3000));
    }

    // Menus
    const menus = Object.entries(json).filter(([k]) => k.startsWith('Menu:' + PLACE_ID));
    console.log(`\n=== ${menus.length} menus ===`);
    for (const [k, v] of menus.slice(0, 5)) {
      console.log(k, '→', JSON.stringify(v));
    }
  } else {
    console.log('APOLLO_STATE not found, trying ROOT_QUERY...');
    const rootMatch = homeHtml.match(/__APOLLO_STATE__"\s*:\s*(\{[\s\S]*?\})\s*<\/script>/);
    if (rootMatch) console.log('Found via different pattern, len:', rootMatch[1].length);
    else console.log('No embedded data found');
  }

  // 2) GraphQL with proper header
  const r = await probe(
    `https://pcmap-api.place.naver.com/place/${PLACE_ID}/summary`,
  );
  console.log('\nGraphQL summary:', JSON.stringify(r, null, 2));
})();

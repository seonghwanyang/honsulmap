export {};

const SESSION_ID = '70474750771%3AmuaWxzsxtakiL4%3A20%3AAYhRSj3YxAyXiaNz8b989PSqAtqkN5AKpedniduapQ';
const CSRF = 't0pDDqAjy7RMiZk9zkV8SRNH5kl8RMFA';
const DS_USER = '70474750771';
const IG_DID = '587930A0-4392-4AD9-86C2-C59CE676FD12';
const MID = 'aIPTYQALAAGZbhWoLkdGlLP5FKcL';

const cookie = [
  `sessionid=${SESSION_ID}`,
  `csrftoken=${CSRF}`,
  `ds_user_id=${DS_USER}`,
  `ig_did=${IG_DID}`,
  `mid=${MID}`,
].join('; ');

async function probe(name: string, url: string) {
  const res = await fetch(url, {
    headers: {
      'x-ig-app-id': '936619743392459',
      'x-asbd-id': '359341',
      'x-csrftoken': CSRF,
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
      origin: 'https://www.instagram.com',
      referer: 'https://www.instagram.com/',
      cookie,
    },
  });
  console.log(`[${name}] HTTP`, res.status);
  const text = await res.text();
  try {
    const j = JSON.parse(text);
    console.log(JSON.stringify(j).slice(0, 400));
  } catch {
    console.log(text.slice(0, 300));
  }
  console.log('---');
}

(async () => {
  // 1) Reel for @instagram (probe used by the cron)
  await probe(
    'instagram-reel',
    'https://i.instagram.com/api/v1/feed/reels_media/?reel_ids=25025320',
  );

  // 2) Reel for sosu.jeju (the actual venue we care about)
  await probe(
    'sosu-reel',
    'https://i.instagram.com/api/v1/feed/reels_media/?reel_ids=51229272669',
  );

  // 3) Auth-required: my own logged-in user info via the web profile API
  await probe(
    'my-profile',
    'https://i.instagram.com/api/v1/users/web_profile_info/?username=instagram',
  );
})();

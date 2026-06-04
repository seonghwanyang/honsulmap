// Soft metered gate: guests may open up to FREE_SPOT_VIEWS distinct spots
// PER DAY, after which opening a new one prompts login. Resets at local
// midnight (the stored day-key is the device's local date). Tracked in
// localStorage — intentionally soft (gentle conversion, not DRM). Logged-in
// users are never metered.
const KEY = 'honsulmap_viewed_spots';
export const FREE_SPOT_VIEWS = 3;

// Local calendar day, e.g. "2026-6-4". Stored alongside the slugs so a new
// day reads as a clean slate (no need to actively clear anything).
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

type Stored = { date: string; slugs: string[] };

// Returns today's viewed slugs. Anything stored under a previous day is
// treated as empty → the count resets at midnight.
function read(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null') as Stored | null;
    if (!raw || raw.date !== todayKey() || !Array.isArray(raw.slugs)) return [];
    return raw.slugs.filter((x) => typeof x === 'string');
  } catch {
    return [];
  }
}

function write(slugs: string[]) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ date: todayKey(), slugs: slugs.slice(-50) }),
    );
  } catch {
    // private mode — gate just won't persist, fine
  }
}

// Whether a guest may open this spot today. Already-seen spots are always
// allowed (re-opening doesn't burn a credit); a new spot is allowed only
// while under the daily free limit. Call only for guests.
export function guestMayOpenSpot(slug: string): boolean {
  const seen = read();
  if (seen.includes(slug)) return true;
  return seen.length < FREE_SPOT_VIEWS;
}

// Record a guest opening a new spot today. No-op if already recorded.
export function recordGuestSpotView(slug: string) {
  const seen = read();
  if (!seen.includes(slug)) write([...seen, slug]);
}

export function guestViewCount(): number {
  return read().length;
}

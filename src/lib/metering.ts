// Soft metered gate: guests may open up to FREE_SPOT_VIEWS distinct spots,
// after which opening a NEW one prompts login. Tracked in localStorage —
// intentionally soft (the goal is gentle conversion, not DRM). Logged-in
// users are never metered.
const KEY = 'honsulmap_viewed_spots';
export const FREE_SPOT_VIEWS = 3;

function read(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-50)));
  } catch {
    // private mode — gate just won't persist, fine
  }
}

// Whether a guest may open this spot. Already-seen spots are always allowed
// (re-opening doesn't burn a credit); a new spot is allowed only while under
// the free limit. Call only for guests (skip for logged-in users).
export function guestMayOpenSpot(slug: string): boolean {
  const seen = read();
  if (seen.includes(slug)) return true;
  return seen.length < FREE_SPOT_VIEWS;
}

// Record a guest opening a new spot. No-op if already recorded.
export function recordGuestSpotView(slug: string) {
  const seen = read();
  if (!seen.includes(slug)) write([...seen, slug]);
}

export function guestViewCount(): number {
  return read().length;
}

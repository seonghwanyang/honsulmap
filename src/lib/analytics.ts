// GA4 event tracking helpers — strongly typed wrappers around window.gtag.
//
// Phase 2 catalog: 15 events from the Phase 1 analytics rollout. Param names
// stay snake_case to match GA4 conventions. Module-level dedup state keeps
// noisy events (story impressions, scroll depth tiers) firing at most once
// per session/page.

declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'set' | 'js',
      action: string,
      params?: Record<string, unknown>,
    ) => void;
  }
}

export type EntrySource = 'map' | 'feed' | 'search' | 'community' | 'direct';
export type StorySurface = 'map_sheet' | 'spot_page' | 'feed';
export type FilterSurface = 'map' | 'feed' | 'community';
export type IgSurface =
  | 'map_sheet_action'
  | 'map_sheet_empty'
  | 'spot_page_action'
  | 'spot_page_empty';
export type PageId = 'spot' | 'feed' | 'post' | 'community';
export type ScrollDepth = 25 | 50 | 75 | 100;

// Per-event param shapes. Discriminated by the event-name key on the
// EventParams map below.
type StoryImpressionParams = {
  story_id: string;
  spot_id: string;
  region?: string;
  category?: string;
  surface: StorySurface;
};
type StoryPlayParams = {
  story_id: string;
  spot_id: string;
  surface: StorySurface;
};
type StoryProgress75Params = StoryPlayParams;
type StoryCompleteParams = StoryPlayParams;
type SpotPanelDwellParams = {
  spot_id: string;
  dwell_ms: number;
  entry_source: EntrySource;
};
type PageDwellParams = {
  page: PageId;
  path_id: string;
  dwell_ms: number;
};
type ScrollDepthParams = {
  page: PageId;
  path_id: string;
  depth: ScrollDepth;
};
type SearchExecutedParams = {
  query_len: number;
  result_count: number;
  picked: boolean;
};
type RegionFilterChangedParams = {
  region: string;
  surface: 'map' | 'feed';
};
type CategoryFilterChangedParams = {
  category: string;
  surface: 'map' | 'community';
};
type PinClickedParams = {
  spot_id: string;
  region: string;
  category: string;
  vibe_tags: string;
  has_active_story: boolean;
};
type SpotDetailEnteredParams = {
  spot_id: string;
  entry_source: EntrySource;
};
type InstagramLinkClickedParams = {
  spot_id: string;
  region: string;
  category: string;
  surface: IgSurface;
};
type SpotRequestSubmittedParams = {
  region: string;
  category: string;
};
type CommunityPostEnteredParams = {
  post_id: string;
  category: string;
  entry_source: EntrySource;
};
type WriteSubmittedParams = {
  category: string;
  has_attached_photos: boolean;
};

export type EventParams = {
  story_impression: StoryImpressionParams;
  story_play: StoryPlayParams;
  story_progress_75: StoryProgress75Params;
  story_complete: StoryCompleteParams;
  spot_panel_dwell: SpotPanelDwellParams;
  page_dwell: PageDwellParams;
  scroll_depth: ScrollDepthParams;
  search_executed: SearchExecutedParams;
  region_filter_changed: RegionFilterChangedParams;
  category_filter_changed: CategoryFilterChangedParams;
  pin_clicked: PinClickedParams;
  spot_detail_entered: SpotDetailEnteredParams;
  instagram_link_clicked: InstagramLinkClickedParams;
  spot_request_submitted: SpotRequestSubmittedParams;
  community_post_entered: CommunityPostEnteredParams;
  write_submitted: WriteSubmittedParams;
  login_started: { provider: 'kakao' | 'google' };
  mood_voted: { spot_id: string; vote: 'up' | 'down' };
  partner_claim_submitted: { spot_id: string };
  partner_spot_managed: { spot_id: string };
  story_login_blocked: { spot_id: string; surface: StorySurface };
  checkin_result: { spot_id: string; result: 'passed' | 'too_far' | 'no_gps'; distance_m: number | null };
  visit: { spot_id: string };
  like: { spot_id: string };
  favorite_added: { spot_id: string };
  feed_load_more: { region: string; loaded: number };
  gps_centered: { lat: number; lng: number };
  pwa_installed: { platform?: string };
  pwa_launch_standalone: { platform?: string };
};

export type EventName = keyof EventParams;
export type ParamsFor<E extends EventName> = EventParams[E];

export function track<E extends EventName>(name: E, params: ParamsFor<E>): void {
  if (typeof window === 'undefined') return;
  if (typeof window.gtag !== 'function') return;
  window.gtag('event', name, params as Record<string, unknown>);
}

// Dedup state — module-level so it survives across hook mounts within a
// session. Cleared by full page reload, which is what we want.
const oneShotStoryEvents = new Set<string>();
const scrollDepthFired = new Map<string, Set<number>>();

export function shouldFireOnceForStory(
  eventName: 'story_impression' | 'story_play' | 'story_progress_75' | 'story_complete',
  storyId: string,
): boolean {
  const key = `${eventName}:${storyId}`;
  if (oneShotStoryEvents.has(key)) return false;
  oneShotStoryEvents.add(key);
  return true;
}

export function shouldFireScrollDepth(
  page: PageId,
  pathId: string,
  depth: ScrollDepth,
): boolean {
  const key = `${page}:${pathId}`;
  let tiers = scrollDepthFired.get(key);
  if (!tiers) {
    tiers = new Set<number>();
    scrollDepthFired.set(key, tiers);
  }
  if (tiers.has(depth)) return false;
  tiers.add(depth);
  return true;
}

export function resetScrollDepthFor(page: PageId, pathId: string): void {
  scrollDepthFired.delete(`${page}:${pathId}`);
}

export function joinVibes(vibe_tags?: string[] | null): string {
  if (!vibe_tags || vibe_tags.length === 0) return '';
  return vibe_tags.join(',');
}

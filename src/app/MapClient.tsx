'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import LocationPicker from '@/components/LocationPicker';
import CategoryFilter, { CategoryFilterValue } from '@/components/CategoryFilter';
import SpotRequestModal from '@/components/SpotRequestModal';
import WelcomeModal from '@/components/WelcomeModal';
import SpotRequestButton from '@/components/SpotRequestButton';
import SpotSearchBox from '@/components/SpotSearchBox';
import NativeCard from '@/components/ads/NativeCard';
import { SpotWithStories, Story, City, Region } from '@/lib/types';
import { relativeTime, getCategoryLabel, getRegionLabel } from '@/lib/utils';
import { track, joinVibes, shouldFireOnceForStory, type EntrySource } from '@/lib/analytics';
import { useStoryImpression } from '@/lib/hooks/useStoryImpression';

declare global {
  interface Window {
    naver: {
      maps: {
        Map: new (el: HTMLElement, opts: object) => NaverMap;
        LatLng: new (lat: number, lng: number) => NaverLatLng;
        Point: new (x: number, y: number) => NaverPoint;
        Size: new (w: number, h: number) => NaverSize;
        Marker: new (opts: object) => NaverMarker;
        Event: {
          addListener(target: unknown, event: string, handler: (...args: unknown[]) => void): unknown;
          removeListener(listener: unknown): void;
        };
        jsContentLoaded?: boolean;
        onJSContentLoaded?: (() => void) | null;
      };
    };
    __selectSpot?: (spotId: string) => void;
    __zoomToCluster?: (lat: number, lng: number) => void;
  }
}

interface NaverMap {
  setCenter(latlng: NaverLatLng): void;
  panTo(latlng: NaverLatLng): void;
  getZoom(): number;
  setZoom(zoom: number, animate?: boolean): void;
  morph(latlng: NaverLatLng, zoom: number, transitionOptions?: object): void;
  getBounds(): NaverBounds;
}
interface NaverBounds {
  getMin(): NaverLatLng;
  getMax(): NaverLatLng;
}
interface NaverLatLng { lat(): number; lng(): number; }
interface NaverPoint { x: number; y: number; }
interface NaverSize { width: number; height: number; }
interface NaverMarker { setMap(map: NaverMap | null): void; }

const CLUSTER_ZOOM = 12;
const STORY_FRESH_MS = 24 * 60 * 60 * 1000;

// 3-state freshness derived from the markers payload's latest_story_at
// timestamp. IG stories naturally expire after 24h, so older entries are
// "stale" (visited the spot but it's not active right now) vs "fresh".
function getFreshness(spot: Pick<SpotWithStories, 'latest_story_at'>): 'fresh' | 'stale' | 'none' {
  if (!spot.latest_story_at) return 'none';
  const age = Date.now() - new Date(spot.latest_story_at).getTime();
  return age < STORY_FRESH_MS ? 'fresh' : 'stale';
}

function clusterByGrid(spots: SpotWithStories[], zoom: number): SpotWithStories[][] {
  // Larger grid at low zoom to prevent overlapping clusters
  const gridSize = 1.2 / Math.pow(2, Math.max(zoom - 8, 0));
  const buckets = new Map<string, SpotWithStories[]>();
  for (const spot of spots) {
    const key = `${Math.floor(spot.lat / gridSize)}:${Math.floor(spot.lng / gridSize)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(spot);
  }
  return Array.from(buckets.values());
}

// Compact story card sizing — caps height so 3 cards fit per viewport
// instead of the old 9:16 portrait (which filled most of the screen and
// forced 2+ scrolls per spot). object-fit: cover preserves the visual.
// Each story snaps to one full panel viewport — like flipping through IG
// stories. The card stretches to the inner panel height; video/image
// use object-cover so the 9:16 source fills without letterboxing.
const STORY_SLOT_HEIGHT = 'calc(92dvh - 140px)';

// Single story card inside the map's selected-spot panel. Tracks the
// impression once-per-session via IntersectionObserver and emits
// story_play / story_progress_75 / story_complete from the <video>.
// Placeholder card shown in the map sheet while stories are being fetched.
// Matches the height/radius of MapSheetStory so the layout doesn't jump
// when real cards swap in.
function StorySkeleton() {
  return (
    <div
      className="relative w-full animate-pulse"
      style={{ height: STORY_SLOT_HEIGHT, borderRadius: '14px', background: '#e5e7eb', scrollSnapAlign: 'start' }}
    />
  );
}

function MapSheetStory({
  story,
  spot,
}: {
  story: Story;
  spot: SpotWithStories;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useStoryImpression(ref, {
    story_id: story.id,
    spot_id: spot.id,
    region: spot.region,
    category: spot.category,
    surface: 'map_sheet',
  });

  const onPlay = () => {
    if (shouldFireOnceForStory('story_play', story.id)) {
      track('story_play', { story_id: story.id, spot_id: spot.id, surface: 'map_sheet' });
    }
  };
  const onTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (v.duration && v.currentTime / v.duration >= 0.75) {
      if (shouldFireOnceForStory('story_progress_75', story.id)) {
        track('story_progress_75', { story_id: story.id, spot_id: spot.id, surface: 'map_sheet' });
      }
    }
  };
  const onEnded = () => {
    if (shouldFireOnceForStory('story_complete', story.id)) {
      track('story_complete', { story_id: story.id, spot_id: spot.id, surface: 'map_sheet' });
    }
  };

  return (
    <div
      ref={ref}
      className="relative w-full"
      style={{ height: STORY_SLOT_HEIGHT, borderRadius: '14px', overflow: 'hidden', background: '#000', scrollSnapAlign: 'start' }}
    >
      {story.media_type === 'video' ? (
        <video
          src={story.media_url}
          poster={story.thumbnail_url || undefined}
          className="w-full h-full object-cover"
          controls
          playsInline
          muted
          onPlay={onPlay}
          onTimeUpdate={onTimeUpdate}
          onEnded={onEnded}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={story.thumbnail_url || story.media_url}
          alt={`스토리 ${relativeTime(story.posted_at)}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      )}
      {/* Time overlay */}
      <div
        className="absolute top-0 left-0 right-0 px-3 py-2 flex items-center gap-2"
        style={{ background: 'linear-gradient(rgba(0,0,0,0.5), transparent)' }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2h8l-2 10h-4L8 2z" /><path d="M12 12v6" /><path d="M9 18h6" />
          </svg>
        </div>
        <span className="text-xs font-semibold" style={{ color: '#fff' }}>
          {spot.name}
        </span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {relativeTime(story.posted_at)}
        </span>
      </div>
    </div>
  );
}

// Default map center + zoom per city. The server picks initialCity from
// Vercel geo headers and passes it down so the first frame is centered
// on the user's region without waiting for the geolocation API.
const CITY_CENTER: Record<City, { lat: number; lng: number; zoom: number }> = {
  jeju: { lat: 33.3617, lng: 126.5292, zoom: 10 },
  seoul: { lat: 37.5505, lng: 126.9779, zoom: 11 },
};

function MapPageInner({ initialCity }: { initialCity: City }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // URL param wins (deep links, sharing). Otherwise the filter defaults
  // to '전체' — IP geo is too coarse for KR (all ISPs route through
  // Seoul DCs) so auto-filtering by detected city traps Jeju users in
  // Seoul or vice versa. We still center the *map* on initialCity for
  // the first frame, just don't filter spots.
  const city = (searchParams.get('city') || 'all') as City | 'all';
  const region = searchParams.get('region') || 'all';
  const category = (searchParams.get('category') || 'all') as CategoryFilterValue;

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<NaverMap | null>(null);
  const overlaysRef = useRef<NaverMarker[]>([]);
  const userLocationMarkerRef = useRef<NaverMarker | null>(null);

  const [spots, setSpots] = useState<SpotWithStories[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<SpotWithStories | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(10);
  const [viewBounds, setViewBounds] = useState<{ minLat: number; maxLat: number; minLng: number; maxLng: number } | null>(null);
  const [, setTick] = useState(0);
  const [gpsToast, setGpsToast] = useState<string | null>(null);

  // Story pagination state for the currently-selected spot. `total` is
  // the server-reported count; `loading` toggles during initial + "더 보기"
  // fetches so the skeleton/button render correctly even when the spot
  // already has cached stories.
  const [storyTotal, setStoryTotal] = useState<number | null>(null);
  const [storyLoading, setStoryLoading] = useState(false);
  const [storyLoadingMore, setStoryLoadingMore] = useState(false);

  // Swipe-down-to-dismiss state for the spot detail panel
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef<number>(0);
  const dragStartTimeRef = useRef<number>(0);

  // Panel-dwell instrumentation: capture open timestamp + entry source so
  // we can flush spot_panel_dwell on every close path.
  const panelOpenAtRef = useRef<number | null>(null);
  const panelEntrySourceRef = useRef<EntrySource>('map');
  const panelSpotIdRef = useRef<string | null>(null);

  const flushPanelDwell = useCallback(() => {
    if (panelOpenAtRef.current === null || !panelSpotIdRef.current) return;
    const dwell_ms = Date.now() - panelOpenAtRef.current;
    track('spot_panel_dwell', {
      spot_id: panelSpotIdRef.current,
      dwell_ms,
      entry_source: panelEntrySourceRef.current,
    });
    panelOpenAtRef.current = null;
    panelSpotIdRef.current = null;
  }, []);

  const openSpotPanel = useCallback(
    (spot: SpotWithStories, entry_source: EntrySource) => {
      // If a panel is already open for a different spot, flush its dwell
      // before swapping in the next one (replacement-by-other-pin path).
      if (panelSpotIdRef.current && panelSpotIdRef.current !== spot.id) {
        flushPanelDwell();
      }
      panelOpenAtRef.current = Date.now();
      panelEntrySourceRef.current = entry_source;
      panelSpotIdRef.current = spot.id;
      setSelectedSpot(spot);
      track('spot_detail_entered', { spot_id: spot.id, entry_source });
    },
    [flushPanelDwell],
  );

  const closeSpotPanel = useCallback(() => {
    flushPanelDwell();
    setSelectedSpot(null);
  }, [flushPanelDwell]);

  const handleDragStart = (e: React.TouchEvent) => {
    dragStartYRef.current = e.touches[0].clientY;
    dragStartTimeRef.current = Date.now();
    setIsDragging(true);
    setDragY(0);
  };

  const handleDragMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = e.touches[0].clientY - dragStartYRef.current;
    // Only allow downward drag
    setDragY(Math.max(0, delta));
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const elapsed = Date.now() - dragStartTimeRef.current;
    const velocity = elapsed > 0 ? dragY / elapsed : 0; // px/ms
    const DISMISS_THRESHOLD = 80;   // px
    const VELOCITY_THRESHOLD = 0.5; // px/ms
    if (dragY >= DISMISS_THRESHOLD || velocity >= VELOCITY_THRESHOLD) {
      // Animate off-screen then dismiss
      setDragY(window.innerHeight);
      flushPanelDwell();
      setTimeout(() => {
        setSelectedSpot(null);
        setDragY(0);
      }, 220);
    } else {
      // Spring back
      setDragY(0);
    }
  };

  // Re-render every 30s to keep relative times accurate
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Client-side city + region + category filter. Markers endpoint
  // returns every spot so toggling chips doesn't refetch. City filters
  // first (jeju vs seoul), then region (권역 within city), then category.
  const cityFilteredSpots = city === 'all'
    ? spots
    : spots.filter((s) => s.city === city);
  const regionFilteredSpots = region === 'all'
    ? cityFilteredSpots
    : cityFilteredSpots.filter((s) => s.region === region);

  const filteredSpots = regionFilteredSpots.filter((s) => {
    if (category === 'all') return true;
    if (category === 'bar') return s.category === 'bar';
    if (category === 'guesthouse') return s.category === 'guesthouse';
    if (category === 'party-guesthouse')
      return s.category === 'guesthouse' && (s.vibe_tags ?? []).includes('party');
    if (category === 'quiet-guesthouse')
      return s.category === 'guesthouse' && (s.vibe_tags ?? []).includes('quiet');
    return true;
  });

  // Register global spot selector for map markers
  useEffect(() => {
    window.__selectSpot = (spotId: string) => {
      const spot = spots.find((s) => s.id === spotId);
      if (spot) {
        track('pin_clicked', {
          spot_id: spot.id,
          region: spot.region,
          category: spot.category,
          vibe_tags: joinVibes(spot.vibe_tags),
          has_active_story: !!spot.latest_story_at,
        });
        openSpotPanel(spot, 'map');
        setSheetOpen(false);
      }
    };
    return () => { delete window.__selectSpot; };
  }, [spots, openSpotPanel]);

  // Register cluster zoom handler
  useEffect(() => {
    window.__zoomToCluster = (lat: number, lng: number) => {
      if (mapInstanceRef.current && window.naver?.maps) {
        mapInstanceRef.current.morph(new window.naver.maps.LatLng(lat, lng), 13);
      }
    };
    return () => { delete window.__zoomToCluster; };
  }, []);

  // Track zoom changes for clustering + bounds changes for viewport culling
  useEffect(() => {
    if (!mapInstanceRef.current || !window.naver?.maps) return;
    const map = mapInstanceRef.current;

    const updateBounds = () => {
      const b = map.getBounds();
      const min = b.getMin();
      const max = b.getMax();
      setViewBounds({
        minLat: min.lat(),
        maxLat: max.lat(),
        minLng: min.lng(),
        maxLng: max.lng(),
      });
    };
    updateBounds();

    const zoomListener = window.naver.maps.Event.addListener(
      map, 'zoom_changed', (zoom: unknown) => setCurrentZoom(zoom as number),
    );
    const idleListener = window.naver.maps.Event.addListener(map, 'idle', updateBounds);
    return () => {
      window.naver.maps.Event.removeListener(zoomListener);
      window.naver.maps.Event.removeListener(idleListener);
    };
  }, [mapReady]);

  const handleLocationChange = useCallback(
    (c: City | null, r: Region | null) => {
      track('region_filter_changed', { region: r ?? c ?? 'all', surface: 'map' });
      const params = new URLSearchParams(searchParams.toString());
      if (!c) {
        params.delete('city');
        params.delete('region');
      } else {
        params.set('city', c);
        if (r) params.set('region', r);
        else params.delete('region');
      }
      // replace (not push) + scroll:false so the async server component
      // in page.tsx does not re-execute and remount MapClient. router.push
      // here re-rendered the server tree, which manifested as a "hard
      // reload" (map re-init, story state lost, ads re-run) after a few
      // interactions because each push stacked a fresh RSC fetch.
      router.replace(`/?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const handleCategoryChange = useCallback(
    (c: CategoryFilterValue) => {
      track('category_filter_changed', { category: c, surface: 'map' });
      const params = new URLSearchParams(searchParams.toString());
      if (c === 'all') params.delete('category');
      else params.set('category', c);
      router.replace(`/?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Fetch lightweight markers once on mount. Region/category filter is
  // applied client-side from this payload so chip changes don't refetch.
  // Story bodies are lazy-loaded per spot when its panel opens.
  useEffect(() => {
    const fetchSpots = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/spots/markers');
        if (!res.ok) throw new Error('Failed to fetch spots');
        setSpots(await res.json());
      } catch (err) {
        console.error('Spots fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSpots();
  }, []);

  // Track which spots we've already issued a stories fetch for, so the
  // idle-time prefetcher doesn't double-fire when `spots` re-renders.
  const prefetchedRef = useRef<Set<string>>(new Set());

  // Off-state stories cache. Storing fetched stories here (instead of in
  // `spots` state) prevents the 200-marker map from re-rendering on every
  // prefetch tick — the panel reads from this map when opening a spot.
  const prefetchedStoriesRef = useRef<Map<string, { stories: Story[]; total: number }>>(new Map());

  // Lazy-load the first page (5) of stories for the currently-selected
  // spot. Skips when the prefetcher has already cached them, or when the
  // markers payload tells us this spot has never had a story
  // (latest_story_at is null). The full count is returned alongside so
  // we know whether to show "이전 스토리 더 보기".
  useEffect(() => {
    if (!selectedSpot) {
      setStoryTotal(null);
      setStoryLoading(false);
      return;
    }
    if (!selectedSpot.latest_story_at) {
      // Markers payload says no stories — render empty state immediately.
      setStoryTotal(0);
      setStoryLoading(false);
      return;
    }
    if (selectedSpot.stories.length > 0) {
      // Already populated on this selectedSpot (e.g. loadMore appended).
      setStoryTotal((cur) =>
        cur != null && cur >= selectedSpot.stories.length ? cur : selectedSpot.stories.length,
      );
      setStoryLoading(false);
      return;
    }
    const cached = prefetchedStoriesRef.current.get(selectedSpot.id);
    if (cached) {
      // Prefetcher already loaded this spot — hand it to the panel
      // without touching `spots` (so the map markers don't re-render).
      setSelectedSpot((cur) =>
        cur && cur.id === selectedSpot.id ? { ...cur, stories: cached.stories } : cur,
      );
      setStoryTotal(cached.total);
      setStoryLoading(false);
      return;
    }
    let cancelled = false;
    prefetchedRef.current.add(selectedSpot.id);
    setStoryLoading(true);
    setStoryTotal(null);
    (async () => {
      try {
        const res = await fetch(`/api/spots/${selectedSpot.slug}/stories?limit=5&offset=0`);
        if (!res.ok) return;
        const payload = (await res.json()) as { stories: Story[]; total: number };
        if (cancelled) return;
        prefetchedStoriesRef.current.set(selectedSpot.id, {
          stories: payload.stories,
          total: payload.total,
        });
        setSelectedSpot((cur) =>
          cur && cur.id === selectedSpot.id ? { ...cur, stories: payload.stories } : cur,
        );
        setStoryTotal(payload.total);
      } catch (err) {
        console.error('Stories fetch error:', err);
      } finally {
        if (!cancelled) setStoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedSpot?.id]);

  // Fetch the next batch of older stories on user request ("더 보기").
  const loadMoreStories = useCallback(async () => {
    if (!selectedSpot) return;
    if (storyLoadingMore) return;
    const offset = selectedSpot.stories.length;
    setStoryLoadingMore(true);
    try {
      const res = await fetch(
        `/api/spots/${selectedSpot.slug}/stories?limit=5&offset=${offset}`,
      );
      if (!res.ok) return;
      const payload = (await res.json()) as { stories: Story[]; total: number };
      setSelectedSpot((cur) => {
        if (!cur || cur.id !== selectedSpot.id) return cur;
        const merged = [...cur.stories, ...payload.stories];
        // Mirror to the ref cache so re-opening the panel keeps the
        // already-loaded "older" pages without another network call.
        prefetchedStoriesRef.current.set(cur.id, { stories: merged, total: payload.total });
        return { ...cur, stories: merged };
      });
      setStoryTotal(payload.total);
    } catch (err) {
      console.error('Load more stories error:', err);
    } finally {
      setStoryLoadingMore(false);
    }
  }, [selectedSpot, storyLoadingMore]);

  // Idle-time viewport prefetch. When the map settles on a new viewport
  // we fire requestIdleCallback to fill stories for visible spots in the
  // background, so a pin click feels instant. Cache key is spot_id —
  // each spot is fetched at most once per session (until invalidated by
  // the markers refresh below).
  useEffect(() => {
    if (!viewBounds || spots.length === 0) return;
    const padLat = (viewBounds.maxLat - viewBounds.minLat) * 0.1;
    const padLng = (viewBounds.maxLng - viewBounds.minLng) * 0.1;
    const need = spots.filter(
      (s) =>
        s.latest_story_at &&
        !prefetchedRef.current.has(s.id) &&
        s.lat >= viewBounds.minLat - padLat &&
        s.lat <= viewBounds.maxLat + padLat &&
        s.lng >= viewBounds.minLng - padLng &&
        s.lng <= viewBounds.maxLng + padLng,
    );
    if (need.length === 0) return;
    need.forEach((s) => prefetchedRef.current.add(s.id));

    let cancelled = false;
    const run = async () => {
      for (const spot of need) {
        if (cancelled) return;
        try {
          const res = await fetch(`/api/spots/${spot.slug}/stories?limit=5&offset=0`);
          if (!res.ok) continue;
          const payload = (await res.json()) as { stories: Story[]; total: number };
          if (cancelled) return;
          // Stash in the off-state cache only — writing to React state
          // would force every pin to re-render and stall the map.
          prefetchedStoriesRef.current.set(spot.id, {
            stories: payload.stories,
            total: payload.total,
          });
        } catch {
          // Best-effort prefetch — silently skip and let lazy-load
          // recover if the user clicks this spot.
        }
      }
    };
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number })
      .requestIdleCallback;
    if (typeof ric === 'function') {
      ric(run, { timeout: 2000 });
    } else {
      setTimeout(run, 100);
    }
    return () => { cancelled = true; };
  }, [viewBounds, spots]);

  // Every 5 min refresh the markers list. If a spot's latest_story_at
  // changed, drop the spot's cached stories so the next click (or next
  // viewport prefetch) re-fetches just that one.
  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch('/api/spots/markers');
        if (!res.ok) return;
        const fresh = (await res.json()) as SpotWithStories[];
        setSpots((prev) => {
          const byId = new Map(prev.map((s) => [s.id, s.latest_story_at]));
          for (const f of fresh) {
            const prevAt = byId.get(f.id);
            if (prevAt != null && prevAt !== f.latest_story_at) {
              prefetchedRef.current.delete(f.id);
              prefetchedStoriesRef.current.delete(f.id);
            }
          }
          return fresh;
        });
      } catch {
        // Silent — next tick will retry.
      }
    };
    const id = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Initialize map via onReady callback (called by Script component)
  const initMap = useCallback(() => {
    console.log('[MAP] initMap called', {
      clientId: process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID,
      hasNaver: !!window.naver,
      hasMaps: !!window.naver?.maps,
      jsContentLoaded: window.naver?.maps?.jsContentLoaded,
    });
    if (!mapRef.current || mapInstanceRef.current) return;
    if (!window.naver?.maps) {
      console.warn('[MAP] window.naver.maps not ready, script may have failed');
      return;
    }

    const create = () => {
      if (mapInstanceRef.current || !mapRef.current) return;
      try {
        const ctr = CITY_CENTER[initialCity];
        mapInstanceRef.current = new window.naver.maps.Map(mapRef.current, {
          center: new window.naver.maps.LatLng(ctr.lat, ctr.lng),
          zoom: ctr.zoom,
        });
        console.log('[MAP] Map instance created');
        setMapReady(true);
      } catch (e) {
        console.error('[MAP] Failed to create Map instance:', e);
      }
    };

    if (window.naver.maps.jsContentLoaded) {
      create();
    } else {
      window.naver.maps.onJSContentLoaded = create;
      // 레이스 방지: 등록 직후 재확인
      if (window.naver.maps.jsContentLoaded) create();
    }
  }, []);

  // Render markers (individual or clustered based on zoom)
  useEffect(() => {
    if (!mapInstanceRef.current || !window.naver?.maps) return;

    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    const esc = (s: string) => s.replace(/'/g, '&#39;').replace(/"/g, '&quot;');

    // Active-pin background color per category. Bar keeps the signature
    // dark; guesthouse uses a softer pastel blue so the two are
    // distinguishable at a glance even when the glyph is too small to
    // read (low zoom).
    const activeBg = (spot: SpotWithStories) =>
      spot.category === 'guesthouse' ? '#60A5FA' : '#111827';

    // Returns the inner SVG glyph string for a spot based on category + vibe_tags
    const spotIcon = (spot: SpotWithStories, iconSz: number, strokeColor: string): string => {
      const stroke = `stroke="${strokeColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"`;
      const svgOpen = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSz}" height="${iconSz}" viewBox="0 0 24 24" fill="none" ${stroke}>`;
      if (spot.category === 'bar') {
        return `${svgOpen}<path d="M8 2h8l-2 10h-4L8 2z"/><path d="M12 12v6"/><path d="M9 18h6"/></svg>`;
      }
      if (spot.category === 'guesthouse' && (spot.vibe_tags ?? []).includes('party')) {
        return `${svgOpen}<path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-1.99.21a2.9 2.9 0 0 0-2.4 1.99l-.45 1.21c-.39 1.06-1.27 1.86-2.36 2.16L13 19"/></svg>`;
      }
      // guesthouse (quiet or general) → home icon
      return `${svgOpen}<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
    };

    const renderSpotMarker = (spot: SpotWithStories) => {
      const freshness = getFreshness(spot);
      const hasStory = freshness !== 'none';
      const isFresh = freshness === 'fresh';
      const sz = hasStory ? 32 : 24;
      const iconSz = hasStory ? 14 : 11;
      const tailW = hasStory ? 6 : 4;
      const tailH = hasStory ? 7 : 5;
      const strokeColor = hasStory ? '#fff' : '#9ca3af';
      const glassIcon = spotIcon(spot, iconSz, strokeColor);

      const baseBg = activeBg(spot);
      // Stale (>24h) spots wear a pastel-washed version of activeBg — same
      // shape and size as fresh, but no purple dot and noticeably dimmer
      // so the eye still picks out today's spots first.
      const stalePastel = `color-mix(in srgb, ${baseBg} 45%, #fff 55%)`;
      const bg = !hasStory ? '#fff' : isFresh ? baseBg : stalePastel;
      const border = !hasStory
        ? '1.5px solid #d1d5db'
        : isFresh
          ? '2px solid #fff'
          : `2px solid color-mix(in srgb, #fff 70%, ${baseBg} 30%)`;
      const tailColor = !hasStory ? '#d1d5db' : isFresh ? baseBg : stalePastel;
      const shadow = hasStory
        ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
        : 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))';
      const name = esc(spot.name);
      // Purple story dot — fresh only. Stale spots had a story but it's
      // outside the 24h activity window, so we drop the dot/tipBadge to
      // signal "not active now".
      const storyDot = isFresh ? `<span style="position:absolute;top:-1px;right:-1px;width:8px;height:8px;border-radius:50%;background:#7C3AED;border:1.5px solid #fff;"></span>` : '';
      const tipBadge = isFresh ? `<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#7C3AED;margin-left:4px;flex-shrink:0;"></span>` : '';

      const content = `
        <div onclick="window.__selectSpot && window.__selectSpot('${spot.id}')"
          onmouseenter="this.style.transform='scale(1.15)';this.querySelector('.sp-tip').style.opacity='1';this.querySelector('.sp-tip').style.transform='translateX(-50%) translateY(0)'"
          onmouseleave="this.style.transform='scale(1)';this.querySelector('.sp-tip').style.opacity='0';this.querySelector('.sp-tip').style.transform='translateX(-50%) translateY(4px)'"
          onmousedown="this.style.transform='scale(0.93)'"
          onmouseup="this.style.transform='scale(1.15)'"
          style="cursor:pointer;display:flex;flex-direction:column;align-items:center;filter:${shadow};transition:transform 0.15s ease;transform-origin:center bottom;">
          <div class="sp-tip" style="opacity:0;transition:all 0.15s ease;pointer-events:none;
            position:absolute;bottom:${sz + tailH + 4}px;left:50%;transform:translateX(-50%) translateY(4px);white-space:nowrap;
            background:#111827;color:#fff;font-size:11px;font-weight:500;padding:4px 8px;border-radius:6px;
            display:flex;align-items:center;z-index:1;">
            <span style="position:absolute;left:50%;bottom:-4px;margin-left:-4px;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:4px solid #111827;"></span>
            ${name}${tipBadge}
          </div>
          <div style="position:relative;width:${sz}px;height:${sz}px;border-radius:50%;background:${bg};border:${border};display:flex;align-items:center;justify-content:center;">
            ${glassIcon}${storyDot}
          </div>
          <div style="width:0;height:0;border-left:${tailW}px solid transparent;border-right:${tailW}px solid transparent;border-top:${tailH}px solid ${tailColor};margin-top:-1px;"></div>
        </div>
      `;

      const totalH = sz + tailH - 1;
      return new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(spot.lat, spot.lng),
        map: mapInstanceRef.current!,
        // Fresh pins (<24h) sit highest, then stale (had a story but
        // outside the 24h window), then never-had-a-story. Keeps today's
        // activity visible when shore clusters get tight.
        zIndex: isFresh ? 200 : hasStory ? 150 : 100,
        icon: {
          content,
          size: new window.naver.maps.Size(sz, totalH),
          anchor: new window.naver.maps.Point(sz / 2, totalH),
        },
      });
    };

    // Viewport culling: only render markers within the visible map bounds
    // (with a small padding so markers near the edge stay visible during pan).
    // Falls back to all filteredSpots before the first bounds measurement.
    const visibleSpots = viewBounds
      ? (() => {
          const padLat = (viewBounds.maxLat - viewBounds.minLat) * 0.1;
          const padLng = (viewBounds.maxLng - viewBounds.minLng) * 0.1;
          return filteredSpots.filter(
            (s) =>
              s.lat >= viewBounds.minLat - padLat &&
              s.lat <= viewBounds.maxLat + padLat &&
              s.lng >= viewBounds.minLng - padLng &&
              s.lng <= viewBounds.maxLng + padLng,
          );
        })()
      : filteredSpots;

    if (currentZoom >= CLUSTER_ZOOM) {
      visibleSpots.forEach((spot) => {
        overlaysRef.current.push(renderSpotMarker(spot));
      });
    } else {
      const clusters = clusterByGrid(visibleSpots, currentZoom);
      clusters.forEach((cluster) => {
        const avgLat = cluster.reduce((s, sp) => s + sp.lat, 0) / cluster.length;
        const avgLng = cluster.reduce((s, sp) => s + sp.lng, 0) / cluster.length;
        const clusterHasFresh = cluster.some((sp) => getFreshness(sp) === 'fresh');
        const clusterHasStale = !clusterHasFresh && cluster.some((sp) => getFreshness(sp) === 'stale');
        const hasStory = clusterHasFresh || clusterHasStale;
        const count = cluster.length;
        const isSingle = count === 1;
        const singleIsFresh = isSingle && clusterHasFresh;

        const sz = isSingle ? 22 : Math.min(28 + count * 2, 44);
        const tailH = isSingle ? 5 : 7;
        const tailW = isSingle ? 4 : 5;
        const totalH = sz + tailH - 1;

        const singleColor = isSingle ? activeBg(cluster[0]) : '#111827';
        const singleStalePastel = `color-mix(in srgb, ${singleColor} 45%, #fff 55%)`;
        const bg = isSingle
          ? (!hasStory ? '#fff' : singleIsFresh ? singleColor : singleStalePastel)
          : '#111827';
        const border = isSingle
          ? (!hasStory
              ? '1.5px solid #d1d5db'
              : singleIsFresh
                ? 'none'
                : `1px solid color-mix(in srgb, #fff 70%, ${singleColor} 30%)`)
          : 'none';
        const tailColor = isSingle
          ? (!hasStory ? '#d1d5db' : singleIsFresh ? singleColor : singleStalePastel)
          : '#111827';
        const shadow = 'drop-shadow(0 1px 3px rgba(0,0,0,0.15))';

        // Purple dot signals "active right now (<24h)". Stale single pins
        // and stale-only multi clusters drop it.
        const storyDot = singleIsFresh
          ? `<span style="position:absolute;top:-1px;right:-1px;width:7px;height:7px;border-radius:50%;background:#7C3AED;border:1.5px solid #fff;"></span>`
          : '';
        const clusterStoryDot = clusterHasFresh && !isSingle
          ? `<span style="position:absolute;top:-2px;right:-2px;width:10px;height:10px;border-radius:50%;background:#7C3AED;border:2px solid #fff;"></span>`
          : '';

        const inner = isSingle
          ? spotIcon(cluster[0], 10, hasStory ? '#fff' : '#9ca3af')
          : `<span style="color:#fff;font-weight:600;font-size:${sz > 36 ? 14 : 12}px;">${count}</span>`;

        const clickFn = isSingle
          ? `window.__selectSpot && window.__selectSpot('${cluster[0].id}')`
          : `window.__zoomToCluster && window.__zoomToCluster(${avgLat},${avgLng})`;
        const tipText = isSingle ? esc(cluster[0].name) : `${count}개 가게`;
        const tipBadge = clusterHasFresh ? `<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#7C3AED;margin-left:4px;flex-shrink:0;"></span>` : '';

        const content = `
          <div onclick="${clickFn}"
            onmouseenter="this.style.transform='scale(1.12)';this.querySelector('.cl-tip').style.opacity='1';this.querySelector('.cl-tip').style.transform='translateX(-50%) translateY(0)'"
            onmouseleave="this.style.transform='scale(1)';this.querySelector('.cl-tip').style.opacity='0';this.querySelector('.cl-tip').style.transform='translateX(-50%) translateY(4px)'"
            onmousedown="this.style.transform='scale(0.93)'"
            onmouseup="this.style.transform='scale(1.12)'"
            style="cursor:pointer;display:flex;flex-direction:column;align-items:center;filter:${shadow};transition:transform 0.15s ease;transform-origin:center bottom;">
            <div class="cl-tip" style="opacity:0;transition:all 0.15s ease;pointer-events:none;
              position:absolute;bottom:${totalH + 4}px;left:50%;transform:translateX(-50%) translateY(4px);white-space:nowrap;
              background:#111827;color:#fff;font-size:11px;font-weight:500;padding:4px 8px;border-radius:6px;
              display:flex;align-items:center;z-index:1;">
              <span style="position:absolute;left:50%;bottom:-4px;margin-left:-4px;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:4px solid #111827;"></span>
              ${tipText}${tipBadge}
            </div>
            <div style="position:relative;width:${sz}px;height:${sz}px;border-radius:50%;background:${bg};border:${border};
              display:flex;align-items:center;justify-content:center;">
              ${inner}${storyDot}${clusterStoryDot}
            </div>
            <div style="width:0;height:0;border-left:${tailW}px solid transparent;border-right:${tailW}px solid transparent;border-top:${tailH}px solid ${tailColor};margin-top:-1px;"></div>
          </div>
        `;

        const marker = new window.naver.maps.Marker({
          position: new window.naver.maps.LatLng(avgLat, avgLng),
          map: mapInstanceRef.current!,
          icon: { content, size: new window.naver.maps.Size(sz, totalH), anchor: new window.naver.maps.Point(sz / 2, totalH) },
        });
        overlaysRef.current.push(marker);
      });
    }
  }, [filteredSpots, mapReady, currentZoom, viewBounds]);

  const handleGps = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const latlng = new window.naver.maps.LatLng(lat, lng);
        mapInstanceRef.current!.morph(latlng, 15);

        // Inject keyframes once
        if (!document.getElementById('gps-pulse-style')) {
          const style = document.createElement('style');
          style.id = 'gps-pulse-style';
          style.textContent = '@keyframes gps-pulse{0%{transform:scale(1);opacity:0.6}70%{transform:scale(2.2);opacity:0}100%{transform:scale(2.2);opacity:0}}';
          document.head.appendChild(style);
        }

        const markerContent =
          '<div style="position:relative;width:18px;height:18px;">' +
            '<div style="position:absolute;inset:0;border-radius:50%;background:#4285F4;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.15);z-index:2;"></div>' +
            '<div style="position:absolute;inset:-12px;border-radius:50%;background:rgba(66,133,244,0.2);animation:gps-pulse 2s ease-out infinite;"></div>' +
          '</div>';

        if (userLocationMarkerRef.current) {
          userLocationMarkerRef.current.setMap(null);
        }
        userLocationMarkerRef.current = new window.naver.maps.Marker({
          position: latlng,
          map: mapInstanceRef.current!,
          icon: {
            content: markerContent,
            size: new window.naver.maps.Size(18, 18),
            anchor: new window.naver.maps.Point(9, 9),
          },
        });

        track('gps_centered', { lat, lng });
      },
      (err) => {
        console.error('GPS error:', err);
        const msg = err.code === 1
          ? '위치 권한이 필요해요'
          : '현재 위치를 가져올 수 없어요';
        setGpsToast(msg);
        setTimeout(() => setGpsToast(null), 3000);
      },
    );
  };

  const handleSelectFromCircle = (spot: SpotWithStories) => {
    setSelectedSpot(spot);
    setSheetOpen(false);
    if (mapInstanceRef.current && window.naver?.maps) {
      mapInstanceRef.current.panTo(new window.naver.maps.LatLng(spot.lat, spot.lng));
    }
  };

  const activeStories = selectedSpot
    ? [...selectedSpot.stories].sort(
        (a: Story, b: Story) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime(),
      )
    : [];

  // Stories are loading when an initial fetch is in flight. Falls back
  // to the markers-payload hint (latest_story_at != null but no stories
  // cached yet) so the skeleton appears the instant the panel opens,
  // before the useEffect has had a chance to flip storyLoading on.
  const isLoadingStories =
    selectedSpot != null &&
    activeStories.length === 0 &&
    (storyLoading ||
      (selectedSpot.latest_story_at != null && storyTotal == null));

  // Whether the "이전 스토리 더 보기" button should render. Visible when
  // we know the server has more stories than we've loaded.
  const canLoadMoreStories =
    selectedSpot != null &&
    storyTotal != null &&
    activeStories.length > 0 &&
    activeStories.length < storyTotal;

  const instagramUrl = selectedSpot?.instagram_id
    ? `https://www.instagram.com/${selectedSpot.instagram_id}/`
    : null;

  return (
    <div className="relative w-full" style={{ height: '100dvh', background: '#f8f9fa' }}>
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center px-4 h-14 bg-white/95 backdrop-blur-md border-b border-[#F0F0F0]">
        <div className="flex flex-col justify-center gap-px">
          <span className="font-bold leading-tight text-[17px] tracking-[-0.3px] text-[#111827]">
            혼술맵
          </span>
          <span className="leading-tight text-[11px] tracking-[0.1px] text-[#888888]">
            제주 혼술바 실시간
          </span>
        </div>
      </header>

      {/* Region Filter + Category Filter + Spot Request Banner (same bg so they feel unified) */}
      <div className="absolute z-20 left-0 right-0 top-14 bg-white/95 backdrop-blur-sm border-b border-[#F0F0F0]">
        <LocationPicker
          city={city === 'all' ? null : city}
          region={region === 'all' ? null : (region as Region)}
          onChange={handleLocationChange}
        />
        {/* <CategoryFilter selected={category} onChange={handleCategoryChange} /> */}
        <div className="hidden sm:block px-4 pb-3">
          <SpotRequestButton variant="banner" />
        </div>
      </div>

      {/* Spot Search (floats below the banner block with a gap so it
          doesn't hug the boundary line). Hidden once a spot's detail
          sheet is on screen so the search bar doesn't sit on top of the
          spot name and quick-action chips, and also hidden while the
          spot-request modal is open since the modal's body sits at the
          same vertical offset and the search would peek through. */}
      {!selectedSpot && !requestOpen && (
        <SpotSearchBox
          spots={regionFilteredSpots}
          onPick={(spot) => {
            // Pan/zoom first so the user sees where the spot actually is
            // on the map. After a short beat, slide the detail panel up
            // so they can read the stories in context. The 700ms delay
            // is intentional — it lets the camera move register before
            // the panel covers the pin.
            if (mapInstanceRef.current && window.naver?.maps) {
              mapInstanceRef.current.morph(
                new window.naver.maps.LatLng(spot.lat, spot.lng),
                16,
              );
            }
            setSelectedSpot(null);
            setSheetOpen(false);
            setTimeout(() => {
              openSpotPanel(spot, 'search');
            }, 700);
          }}
        />
      )}


      {/* Naver Maps Script */}
      <Script
        src={`https://openapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID}`}
        strategy="afterInteractive"
        onReady={initMap}
        onLoad={() => console.log('[MAP] Script loaded')}
        onError={(e) => console.error('[MAP] Script load error:', e)}
      />

      {/* Map - wrapper keeps size when Naver SDK overrides position:relative on inner div */}
      <div className="absolute inset-0 z-[1]">
        <div ref={mapRef} id="map" className="w-full h-full" />
      </div>

      {/* Loading overlay - separate from map div */}
      {!mapReady && (
        <div className="absolute inset-0 z-[2] flex items-center justify-center bg-gray-100">
          <span className="text-sm text-gray-400">지도 로딩 중...</span>
        </div>
      )}

      {/* FAB buttons */}
      <div className="absolute z-30 flex flex-col gap-2" style={{ bottom: '100px', right: '16px' }}>
        <button
          onClick={() => setRequestOpen(true)}
          className="w-11 h-11 flex items-center justify-center shadow-lg"
          style={{ background: '#ffffff', borderRadius: '50%', border: '1px solid #e5e7eb' }}
          aria-label="가게 제안하기"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <button
          onClick={handleGps}
          className="w-11 h-11 flex items-center justify-center shadow-lg"
          style={{ background: '#ffffff', borderRadius: '50%', border: '1px solid #e5e7eb' }}
          aria-label="현재 위치"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        </button>
        <button
          onClick={() => { setSheetOpen((v) => !v); flushPanelDwell(); setSelectedSpot(null); }}
          className="w-11 h-11 flex items-center justify-center shadow-lg"
          style={{ background: '#111827', borderRadius: '50%' }}
          aria-label="목록 보기"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>
      </div>

      {/* GPS error toast */}
      {gpsToast && (
        <div
          className="absolute z-50 left-1/2"
          style={{ bottom: '160px', transform: 'translateX(-50%)', pointerEvents: 'none' }}
        >
          <div
            style={{
              background: 'rgba(31,31,31,0.88)',
              color: '#fff',
              fontSize: '13px',
              padding: '8px 16px',
              borderRadius: '999px',
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(4px)',
            }}
          >
            {gpsToast}
          </div>
        </div>
      )}

      <SpotRequestModal open={requestOpen} onClose={() => setRequestOpen(false)} />
      <WelcomeModal
        onFindNearby={handleGps}
        onReportSpot={() => setRequestOpen(true)}
      />

      {/* Bottom Sheet: Spot List */}
      <div
        className="absolute left-0 right-0 z-[25] overflow-hidden"
        style={{
          bottom: 0,
          height: '340px',
          background: '#ffffff',
          borderTop: '1px solid #e5e7eb',
          borderRadius: '16px 16px 0 0',
          transform: sheetOpen && !selectedSpot ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s ease',
          boxShadow: sheetOpen ? '0 -4px 20px rgba(0,0,0,0.08)' : 'none',
        }}
      >
        <div className="flex justify-center pt-2 pb-1">
          <div style={{ width: '36px', height: '4px', background: '#d1d5db', borderRadius: '2px' }} />
        </div>
        <div className="flex items-center justify-between px-4 py-2">
          <span className="font-semibold text-sm" style={{ color: '#111827' }}>
            가게 목록 {regionFilteredSpots.length > 0 && `(${regionFilteredSpots.length})`}
          </span>
          <button onClick={() => setSheetOpen(false)} className="text-sm" style={{ color: '#9ca3af' }}>닫기</button>
        </div>
        <div className="overflow-y-auto px-4" style={{ height: '260px' }}>
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <span className="text-sm" style={{ color: '#9ca3af' }}>불러오는 중...</span>
            </div>
          ) : regionFilteredSpots.length === 0 ? (
            <div className="flex items-center justify-center h-24">
              <span className="text-sm" style={{ color: '#9ca3af' }}>가게가 없습니다</span>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: '#f3f4f6' }}>
              {regionFilteredSpots.map((spot) => (
                <li key={spot.id}>
                  <button
                    onClick={() => { openSpotPanel(spot, 'map'); setSheetOpen(false); }}
                    className="flex items-center justify-between py-3 w-full text-left"
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#111827' }}>{spot.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{spot.address}</p>
                    </div>
                    {getFreshness(spot) === 'fresh' && (
                      <span
                        className="text-xs font-medium px-2 py-0.5 ml-2 flex-shrink-0"
                        style={{ background: '#EDE9FE', color: '#7C3AED', borderRadius: '999px' }}
                      >
                        스토리
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Bottom Sheet: Selected Spot Detail + Stories */}
      <div
        className="absolute left-0 right-0 z-[25] overflow-hidden"
        style={{
          bottom: 0,
          height: '92dvh',
          background: '#ffffff',
          borderRadius: '16px 16px 0 0',
          transform: selectedSpot
            ? `translateY(${dragY}px)`
            : 'translateY(100%)',
          transition: isDragging ? 'none' : 'transform 0.25s ease-out',
          boxShadow: selectedSpot ? '0 -4px 24px rgba(0,0,0,0.12)' : 'none',
        }}
      >
        {selectedSpot && (
          <>
            {/* Drag handle — touch target for swipe-down-to-dismiss */}
            <div
              className="flex justify-center pt-2 pb-1"
              style={{ cursor: 'grab', touchAction: 'none' }}
              onTouchStart={handleDragStart}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
            >
              <div style={{ width: '36px', height: '4px', background: '#d1d5db', borderRadius: '2px' }} />
            </div>

            {/* Spot Info — also acts as extended drag target */}
            <div
              className="px-4 pt-1 pb-3"
              style={{ borderBottom: '1px solid #f3f4f6', touchAction: 'none' }}
              onTouchStart={handleDragStart}
              onTouchMove={handleDragMove}
              onTouchEnd={handleDragEnd}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold text-base truncate" style={{ color: '#111827' }}>
                    {selectedSpot.name}
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                    {getRegionLabel(selectedSpot.region)} · {getCategoryLabel(selectedSpot.category)}
                    {activeStories.length > 0 && ` · 스토리 ${activeStories.length}개`}
                  </p>
                </div>
                <button
                  onClick={closeSpotPanel}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center"
                  style={{ color: '#9ca3af', background: '#f3f4f6', borderRadius: '50%' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 mt-3">
                <Link
                  href={`/spot/${selectedSpot.slug}`}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
                  style={{ background: '#111827', color: '#fff', borderRadius: '8px', textDecoration: 'none' }}
                >
                  상세보기
                </Link>
                {instagramUrl && (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      track('instagram_link_clicked', {
                        spot_id: selectedSpot.id,
                        region: selectedSpot.region,
                        category: selectedSpot.category,
                        surface: 'map_sheet_action',
                      });
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
                    style={{ background: '#f3f4f6', color: '#374151', borderRadius: '8px', textDecoration: 'none' }}
                  >
                    인스타
                  </a>
                )}
                <a
                  href={selectedSpot.naver_place_id
                    ? `https://map.naver.com/v5/entry/place/${selectedSpot.naver_place_id}`
                    : `https://map.naver.com/v5/search/${encodeURIComponent(selectedSpot.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
                  style={{ background: '#f3f4f6', color: '#16a34a', borderRadius: '8px', textDecoration: 'none' }}
                >
                  네이버지도
                </a>
              </div>

              {/* Compact info bar — only renders when at least one fact is set */}
              {(selectedSpot.business_hours
                || selectedSpot.naver_rating != null
                || selectedSpot.phone) && (
                <div
                  className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2.5 text-[11px]"
                  style={{ color: '#6b7280' }}
                >
                  {selectedSpot.business_hours && (
                    <span className="inline-flex items-center gap-1">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      <span style={{ color: '#374151' }}>{selectedSpot.business_hours}</span>
                    </span>
                  )}
                  {selectedSpot.naver_rating != null && (
                    <span className="inline-flex items-center gap-1">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="0"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      <span style={{ color: '#374151' }}>
                        {selectedSpot.naver_rating.toFixed(2)}
                        {selectedSpot.naver_review_count != null && (
                          <span style={{ color: '#9ca3af' }}> ({selectedSpot.naver_review_count.toLocaleString()})</span>
                        )}
                      </span>
                    </span>
                  )}
                  {selectedSpot.phone && (
                    <a
                      href={`tel:${selectedSpot.phone.replace(/[^0-9+]/g, '')}`}
                      className="inline-flex items-center gap-1"
                      style={{ color: '#374151', textDecoration: 'none' }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      {selectedSpot.phone}
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Stories Vertical Scroll — snap so each story takes one
                panel viewport, like flipping through IG stories. */}
            <div
              className="overflow-y-auto"
              style={{
                height: 'calc(92dvh - 140px)',
                scrollSnapType: 'y proximity',
                scrollBehavior: 'smooth',
              }}
            >
              {isLoadingStories ? (
                <div className="flex flex-col px-4">
                  <StorySkeleton />
                </div>
              ) : activeStories.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <span style={{ fontSize: '40px', opacity: 0.3 }}>📷</span>
                  <p className="text-sm" style={{ color: '#9ca3af' }}>현재 활성 스토리가 없습니다</p>
                  {instagramUrl && (
                    <a
                      href={instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        track('instagram_link_clicked', {
                          spot_id: selectedSpot.id,
                          region: selectedSpot.region,
                          category: selectedSpot.category,
                          surface: 'map_sheet_empty',
                        });
                      }}
                      className="text-xs px-3 py-1.5 font-medium"
                      style={{ background: '#111827', color: '#fff', borderRadius: '6px', textDecoration: 'none' }}
                    >
                      인스타에서 확인
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex flex-col px-4">
                  {(() => {
                    const items: React.ReactNode[] = [];
                    activeStories.forEach((story: Story, idx: number) => {
                      items.push(
                        <MapSheetStory key={story.id} story={story} spot={selectedSpot} />,
                      );
                      // Native ad between stories — sits at its own
                      // natural height; snap still pulls the user to the
                      // next story card.
                      if (idx < activeStories.length - 1) {
                        items.push(<NativeCard key={`ad-${idx}`} />);
                      }
                    });
                    return items;
                  })()}
                  {canLoadMoreStories && (
                    <button
                      type="button"
                      onClick={loadMoreStories}
                      disabled={storyLoadingMore}
                      className="w-full text-sm font-medium py-2.5 mt-3"
                      style={{
                        background: '#f3f4f6',
                        color: '#374151',
                        borderRadius: '10px',
                        opacity: storyLoadingMore ? 0.6 : 1,
                        cursor: storyLoadingMore ? 'default' : 'pointer',
                      }}
                    >
                      {storyLoadingMore ? '불러오는 중…' : '이전 스토리 더 보기'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function MapClient({ initialCity }: { initialCity: City }) {
  return (
    <Suspense
      fallback={
        <div className="w-full flex items-center justify-center" style={{ height: '100dvh', background: '#f8f9fa' }}>
          <span className="text-sm" style={{ color: '#9ca3af' }}>로딩 중...</span>
        </div>
      }
    >
      <MapPageInner initialCity={initialCity} />
    </Suspense>
  );
}

'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import RegionFilter from '@/components/RegionFilter';
import SpotRequestModal from '@/components/SpotRequestModal';
import SpotRequestButton from '@/components/SpotRequestButton';
import SpotSearchBox from '@/components/SpotSearchBox';
import NativeCard from '@/components/ads/NativeCard';
import { SpotWithStories, Story } from '@/lib/types';
import { relativeTime, getCategoryLabel, getRegionLabel } from '@/lib/utils';

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

function MapPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const region = searchParams.get('region') || 'all';

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<NaverMap | null>(null);
  const overlaysRef = useRef<NaverMarker[]>([]);

  const [spots, setSpots] = useState<SpotWithStories[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSpot, setSelectedSpot] = useState<SpotWithStories | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(10);
  const [viewBounds, setViewBounds] = useState<{ minLat: number; maxLat: number; minLng: number; maxLng: number } | null>(null);
  const [, setTick] = useState(0);

  // Swipe-down-to-dismiss state for the spot detail panel
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef<number>(0);
  const dragStartTimeRef = useRef<number>(0);

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

  const spotsWithStories = spots.filter((s) => s.latest_story_at);

  // Register global spot selector for map markers
  useEffect(() => {
    window.__selectSpot = (spotId: string) => {
      const spot = spots.find((s) => s.id === spotId);
      if (spot) {
        setSelectedSpot(spot);
        setSheetOpen(false);
      }
    };
    return () => { delete window.__selectSpot; };
  }, [spots]);

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

  const handleRegionChange = useCallback(
    (r: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (r === 'all') params.delete('region');
      else params.set('region', r);
      router.push(`/?${params.toString()}`);
    },
    [router, searchParams],
  );

  // Fetch spots
  useEffect(() => {
    const fetchSpots = async () => {
      setLoading(true);
      try {
        const url = region && region !== 'all' ? `/api/spots?region=${region}` : '/api/spots';
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch spots');
        setSpots(await res.json());
      } catch (err) {
        console.error('Spots fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSpots();
  }, [region]);

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
        mapInstanceRef.current = new window.naver.maps.Map(mapRef.current, {
          center: new window.naver.maps.LatLng(33.3617, 126.5292),
          zoom: 10,
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

    const renderSpotMarker = (spot: SpotWithStories) => {
      const hasStory = !!spot.latest_story_at;
      const sz = hasStory ? 32 : 24;
      const iconSz = hasStory ? 14 : 11;
      const tailW = hasStory ? 6 : 4;
      const tailH = hasStory ? 7 : 5;
      const glassIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="${iconSz}" height="${iconSz}" viewBox="0 0 24 24" fill="none" stroke="${hasStory ? '#fff' : '#9ca3af'}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2h8l-2 10h-4L8 2z"/><path d="M12 12v6"/><path d="M9 18h6"/></svg>`;

      const bg = hasStory ? '#111827' : '#fff';
      const border = hasStory ? '2px solid #fff' : '1.5px solid #d1d5db';
      const tailColor = hasStory ? '#111827' : '#d1d5db';
      const shadow = hasStory
        ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
        : 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))';
      const name = esc(spot.name);
      // Purple story dot matching design system
      const storyDot = hasStory ? `<span style="position:absolute;top:-1px;right:-1px;width:8px;height:8px;border-radius:50%;background:#7C3AED;border:1.5px solid #fff;"></span>` : '';
      const tipBadge = hasStory ? `<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#7C3AED;margin-left:4px;flex-shrink:0;"></span>` : '';

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
        // Active-story pins sit above inactive ones so they aren't hidden
        // behind cold pins when spots cluster tight on shore.
        zIndex: hasStory ? 200 : 100,
        icon: {
          content,
          size: new window.naver.maps.Size(sz, totalH),
          anchor: new window.naver.maps.Point(sz / 2, totalH),
        },
      });
    };

    // Viewport culling: only render markers within the visible map bounds
    // (with a small padding so markers near the edge stay visible during pan).
    // Falls back to all spots before the first bounds measurement.
    const visibleSpots = viewBounds
      ? (() => {
          const padLat = (viewBounds.maxLat - viewBounds.minLat) * 0.1;
          const padLng = (viewBounds.maxLng - viewBounds.minLng) * 0.1;
          return spots.filter(
            (s) =>
              s.lat >= viewBounds.minLat - padLat &&
              s.lat <= viewBounds.maxLat + padLat &&
              s.lng >= viewBounds.minLng - padLng &&
              s.lng <= viewBounds.maxLng + padLng,
          );
        })()
      : spots;

    if (currentZoom >= CLUSTER_ZOOM) {
      visibleSpots.forEach((spot) => {
        overlaysRef.current.push(renderSpotMarker(spot));
      });
    } else {
      const clusters = clusterByGrid(visibleSpots, currentZoom);
      clusters.forEach((cluster) => {
        const avgLat = cluster.reduce((s, sp) => s + sp.lat, 0) / cluster.length;
        const avgLng = cluster.reduce((s, sp) => s + sp.lng, 0) / cluster.length;
        const hasStory = cluster.some((sp) => !!sp.latest_story_at);
        const count = cluster.length;
        const isSingle = count === 1;

        const sz = isSingle ? 22 : Math.min(28 + count * 2, 44);
        const tailH = isSingle ? 5 : 7;
        const tailW = isSingle ? 4 : 5;
        const totalH = sz + tailH - 1;

        const bg = isSingle
          ? (hasStory ? '#111827' : '#fff')
          : '#111827';
        const border = !hasStory && isSingle ? '1.5px solid #d1d5db' : 'none';
        const tailColor = isSingle
          ? (hasStory ? '#111827' : '#d1d5db')
          : '#111827';
        const shadow = 'drop-shadow(0 1px 3px rgba(0,0,0,0.15))';

        const storyDot = hasStory && isSingle
          ? `<span style="position:absolute;top:-1px;right:-1px;width:7px;height:7px;border-radius:50%;background:#7C3AED;border:1.5px solid #fff;"></span>`
          : '';
        const clusterStoryDot = hasStory && !isSingle
          ? `<span style="position:absolute;top:-2px;right:-2px;width:10px;height:10px;border-radius:50%;background:#7C3AED;border:2px solid #fff;"></span>`
          : '';

        const inner = isSingle
          ? `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${hasStory ? '#fff' : '#9ca3af'}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2h8l-2 10h-4L8 2z"/><path d="M12 12v6"/><path d="M9 18h6"/></svg>`
          : `<span style="color:#fff;font-weight:600;font-size:${sz > 36 ? 14 : 12}px;">${count}</span>`;

        const clickFn = isSingle
          ? `window.__selectSpot && window.__selectSpot('${cluster[0].id}')`
          : `window.__zoomToCluster && window.__zoomToCluster(${avgLat},${avgLng})`;
        const tipText = isSingle ? esc(cluster[0].name) : `${count}개 가게`;
        const tipBadge = hasStory ? `<span style="display:inline-block;width:5px;height:5px;border-radius:50%;background:#7C3AED;margin-left:4px;flex-shrink:0;"></span>` : '';

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
  }, [spots, mapReady, currentZoom, viewBounds]);

  const handleGps = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = new window.naver.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
        mapInstanceRef.current!.setCenter(latlng);
      },
      (err) => console.error('GPS error:', err),
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

      {/* Region Filter + Spot Request Banner (same bg so they feel unified) */}
      <div className="absolute z-20 left-0 right-0 top-14 bg-white/95 backdrop-blur-sm border-b border-[#F0F0F0]">
        <RegionFilter selected={region} onChange={handleRegionChange} />
        <div className="hidden sm:block px-4 pb-3">
          <SpotRequestButton variant="banner" />
        </div>
      </div>

      {/* Spot Search (floats below the banner block with a gap so it
          doesn't hug the boundary line). Hidden once a spot's detail
          sheet is on screen so the search bar doesn't sit on top of the
          spot name and quick-action chips. */}
      {!selectedSpot && (
        <SpotSearchBox
          spots={spots}
          onPick={(spot) => {
            // Pan/zoom only. Opening the detail sheet here used to bury
            // the pin under the Instagram story panel — the user couldn't
            // see where on the map the place actually was. Let them
            // hover/tap the pin themselves if they want details.
            if (mapInstanceRef.current && window.naver?.maps) {
              mapInstanceRef.current.morph(
                new window.naver.maps.LatLng(spot.lat, spot.lng),
                16,
              );
            }
            setSelectedSpot(null);
            setSheetOpen(false);
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
          onClick={() => { setSheetOpen((v) => !v); setSelectedSpot(null); }}
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

      <SpotRequestModal open={requestOpen} onClose={() => setRequestOpen(false)} />

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
            가게 목록 {spots.length > 0 && `(${spots.length})`}
          </span>
          <button onClick={() => setSheetOpen(false)} className="text-sm" style={{ color: '#9ca3af' }}>닫기</button>
        </div>
        <div className="overflow-y-auto px-4" style={{ height: '260px' }}>
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <span className="text-sm" style={{ color: '#9ca3af' }}>불러오는 중...</span>
            </div>
          ) : spots.length === 0 ? (
            <div className="flex items-center justify-center h-24">
              <span className="text-sm" style={{ color: '#9ca3af' }}>가게가 없습니다</span>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: '#f3f4f6' }}>
              {spots.map((spot) => (
                <li key={spot.id}>
                  <button
                    onClick={() => { setSelectedSpot(spot); setSheetOpen(false); }}
                    className="flex items-center justify-between py-3 w-full text-left"
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#111827' }}>{spot.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{spot.address}</p>
                    </div>
                    {spot.latest_story_at && (
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
          height: '85dvh',
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
                  onClick={() => setSelectedSpot(null)}
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
            </div>

            {/* Stories Vertical Scroll */}
            <div className="overflow-y-auto" style={{ height: 'calc(85dvh - 140px)' }}>
              {activeStories.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <span style={{ fontSize: '40px', opacity: 0.3 }}>📷</span>
                  <p className="text-sm" style={{ color: '#9ca3af' }}>현재 활성 스토리가 없습니다</p>
                  {instagramUrl && (
                    <a
                      href={instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs px-3 py-1.5 font-medium"
                      style={{ background: '#111827', color: '#fff', borderRadius: '6px', textDecoration: 'none' }}
                    >
                      인스타에서 확인
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3 px-4 py-3">
                  {(() => {
                    const items: React.ReactNode[] = [];
                    activeStories.forEach((story: Story, idx: number) => {
                      items.push(
                        <div
                          key={story.id}
                          className="relative w-full"
                          style={{ aspectRatio: '9/16', borderRadius: '14px', overflow: 'hidden', background: '#000' }}
                        >
                          {story.media_type === 'video' ? (
                            <video
                              src={story.media_url}
                              poster={story.thumbnail_url || undefined}
                              className="w-full h-full object-cover"
                              controls
                              playsInline
                              muted
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
                              {selectedSpot.name}
                            </span>
                            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                              {relativeTime(story.posted_at)}
                            </span>
                          </div>
                        </div>,
                      );
                      // Insert a native ad after every 5th story, but never
                      // trail the very last story so the panel ends on content.
                      if ((idx + 1) % 5 === 0 && idx < activeStories.length - 1) {
                        items.push(<NativeCard key={`ad-${idx}`} />);
                      }
                    });
                    return items;
                  })()}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full flex items-center justify-center" style={{ height: '100dvh', background: '#f8f9fa' }}>
          <span className="text-sm" style={{ color: '#9ca3af' }}>로딩 중...</span>
        </div>
      }
    >
      <MapPageInner />
    </Suspense>
  );
}

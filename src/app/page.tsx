'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import RegionFilter from '@/components/RegionFilter';
import AdBannerInline from '@/components/AdBannerInline';
import { SpotWithStories } from '@/lib/types';
import { relativeTime } from '@/lib/utils';

declare global {
  interface Window {
    naver: {
      maps: {
        Map: new (el: HTMLElement, opts: object) => NaverMap;
        LatLng: new (lat: number, lng: number) => NaverLatLng;
        Point: new (x: number, y: number) => NaverPoint;
        CustomOverlay: new (opts: object) => NaverOverlay;
      };
    };
  }
}

interface NaverMap {
  setCenter(latlng: NaverLatLng): void;
}

interface NaverLatLng {
  lat(): number;
  lng(): number;
}

interface NaverPoint {
  x: number;
  y: number;
}

interface NaverOverlay {
  setMap(map: NaverMap | null): void;
}

function MapPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const region = searchParams.get('region') || 'all';

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<NaverMap | null>(null);
  const overlaysRef = useRef<NaverOverlay[]>([]);

  const [spots, setSpots] = useState<SpotWithStories[]>([]);
  const [loading, setLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const handleRegionChange = useCallback(
    (r: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (r === 'all') {
        params.delete('region');
      } else {
        params.set('region', r);
      }
      router.push(`/?${params.toString()}`);
    },
    [router, searchParams],
  );

  // Fetch spots
  useEffect(() => {
    const fetchSpots = async () => {
      setLoading(true);
      try {
        const url =
          region && region !== 'all' ? `/api/spots?region=${region}` : '/api/spots';
        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch spots');
        const data = await res.json();
        setSpots(data);
      } catch (err) {
        console.error('Spots fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSpots();
  }, [region]);

  // Load Naver Map script
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
    if (!clientId) return;
    if (document.getElementById('naver-map-script')) {
      setMapReady(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'naver-map-script';
    script.src = `https://openapi.map.naver.com/openapi/v3/maps.js?ncpClientId=${clientId}`;
    script.async = true;
    script.onload = () => setMapReady(true);
    document.head.appendChild(script);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapReady || !mapRef.current || mapInstanceRef.current) return;
    if (!window.naver?.maps) return;
    const map = new window.naver.maps.Map(mapRef.current, {
      center: new window.naver.maps.LatLng(33.3617, 126.5292),
      zoom: 10,
      mapTypeId: 'normal',
    });
    mapInstanceRef.current = map;
  }, [mapReady]);

  // Render overlays
  useEffect(() => {
    if (!mapInstanceRef.current || !window.naver?.maps) return;

    // Remove old overlays
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    spots.forEach((spot) => {
      const hasStory = !!spot.latest_story_at;
      const storyTime = hasStory ? relativeTime(spot.latest_story_at!) : null;
      const label = hasStory ? `${spot.name} · ${storyTime}` : spot.name;
      const borderColor = hasStory ? '#22c55e' : '#cccccc';

      const content = `
        <div
          onclick="window.location.href='/spot/${spot.slug}'"
          style="
            background: #ffffff;
            border: 2px solid ${borderColor};
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 12px;
            font-weight: 600;
            color: #111111;
            white-space: nowrap;
            cursor: pointer;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          "
        >${label}</div>
      `;

      const overlay = new window.naver.maps.CustomOverlay({
        position: new window.naver.maps.LatLng(spot.lat, spot.lng),
        content,
        anchor: new window.naver.maps.Point(0, 0),
      });
      overlay.setMap(mapInstanceRef.current!);
      overlaysRef.current.push(overlay);
    });
  }, [spots, mapReady]);

  const handleGps = () => {
    if (!navigator.geolocation || !mapInstanceRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const latlng = new window.naver.maps.LatLng(
          pos.coords.latitude,
          pos.coords.longitude,
        );
        mapInstanceRef.current!.setCenter(latlng);
      },
      (err) => console.error('GPS error:', err),
    );
  };

  return (
    <div className="relative w-full" style={{ height: '100dvh', background: '#16191E' }}>
      {/* Header */}
      <header
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4"
        style={{ height: '52px', background: 'rgba(22,25,30,0.92)', backdropFilter: 'blur(8px)' }}
      >
        <span className="font-bold text-lg" style={{ color: '#F59E0B' }}>
          제주혼술
        </span>
        <Link
          href="/write"
          className="px-3 py-1.5 text-sm font-semibold"
          style={{ background: '#F59E0B', color: '#111111', borderRadius: '6px' }}
        >
          현황 제보
        </Link>
      </header>

      {/* Region Filter */}
      <div
        className="absolute z-20 left-0 right-0"
        style={{ top: '52px', background: 'rgba(22,25,30,0.85)', backdropFilter: 'blur(4px)' }}
      >
        <RegionFilter selected={region} onChange={handleRegionChange} />
      </div>

      {/* Map */}
      <div
        ref={mapRef}
        id="map"
        className="absolute inset-0"
        style={{ top: 0, zIndex: 1 }}
      >
        {!mapReady && (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: '#1e2127' }}
          >
            <span className="text-sm" style={{ color: '#888888' }}>
              지도 로딩 중...
            </span>
          </div>
        )}
      </div>

      {/* Floating Ad Banner */}
      <div
        className="absolute z-20 flex justify-center"
        style={{ bottom: sheetOpen ? '340px' : '80px', left: 0, right: 0, transition: 'bottom 0.3s ease' }}
      >
        <AdBannerInline size="320x50" />
      </div>

      {/* FAB buttons */}
      <div
        className="absolute z-30 flex flex-col gap-2"
        style={{ bottom: '80px', right: '16px' }}
      >
        <button
          onClick={handleGps}
          className="w-12 h-12 flex items-center justify-center text-xl shadow-lg"
          style={{ background: '#ffffff', borderRadius: '50%', color: '#111111' }}
          aria-label="현재 위치"
        >
          📍
        </button>
        <button
          onClick={() => setSheetOpen((v) => !v)}
          className="w-12 h-12 flex items-center justify-center text-sm font-bold shadow-lg"
          style={{ background: '#F59E0B', borderRadius: '50%', color: '#111111' }}
          aria-label="목록 보기"
        >
          목록
        </button>
      </div>

      {/* FABWrite */}
      <Link
        href="/write"
        className="absolute z-30 w-14 h-14 flex items-center justify-center text-2xl shadow-xl"
        style={{
          bottom: '80px',
          left: '16px',
          background: '#F59E0B',
          borderRadius: '50%',
          color: '#111111',
        }}
        aria-label="글쓰기"
      >
        ✏️
      </Link>

      {/* Bottom Sheet */}
      <div
        className="absolute left-0 right-0 z-25 overflow-hidden"
        style={{
          bottom: '56px',
          height: '300px',
          background: '#16191E',
          borderTop: '1px solid #2a2d33',
          borderRadius: '16px 16px 0 0',
          transform: sheetOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s ease',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-semibold text-sm" style={{ color: '#ffffff' }}>
            가게 목록 {spots.length > 0 && `(${spots.length})`}
          </span>
          <button
            onClick={() => setSheetOpen(false)}
            className="text-sm"
            style={{ color: '#888888' }}
          >
            닫기
          </button>
        </div>

        <div className="overflow-y-auto px-4" style={{ height: '240px' }}>
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <span className="text-sm" style={{ color: '#888888' }}>
                불러오는 중...
              </span>
            </div>
          ) : spots.length === 0 ? (
            <div className="flex items-center justify-center h-24">
              <span className="text-sm" style={{ color: '#888888' }}>
                가게가 없습니다
              </span>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: '#2a2d33' }}>
              {spots.map((spot) => (
                <li key={spot.id}>
                  <Link
                    href={`/spot/${spot.slug}`}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#ffffff' }}>
                        {spot.name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#888888' }}>
                        {spot.address}
                      </p>
                    </div>
                    {spot.latest_story_at && (
                      <span
                        className="text-xs px-2 py-0.5 ml-2 flex-shrink-0"
                        style={{
                          background: '#14532d',
                          color: '#4ade80',
                          borderRadius: '999px',
                        }}
                      >
                        스토리
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div
          className="w-full flex items-center justify-center"
          style={{ height: '100dvh', background: '#16191E' }}
        >
          <span className="text-sm" style={{ color: '#888888' }}>
            로딩 중...
          </span>
        </div>
      }
    >
      <MapPageInner />
    </Suspense>
  );
}

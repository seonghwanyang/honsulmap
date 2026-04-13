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

    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    spots.forEach((spot) => {
      const hasStory = !!spot.latest_story_at;
      const storyTime = hasStory ? relativeTime(spot.latest_story_at!) : null;
      const label = hasStory ? `${spot.name} · ${storyTime}` : spot.name;
      const bgColor = hasStory ? '#3B82F6' : '#ffffff';
      const textColor = hasStory ? '#ffffff' : '#374151';
      const borderColor = hasStory ? '#2563EB' : '#d1d5db';

      const content = `
        <div
          onclick="window.location.href='/spot/${spot.slug}'"
          style="
            background: ${bgColor};
            border: 1.5px solid ${borderColor};
            border-radius: 999px;
            padding: 4px 10px;
            font-size: 12px;
            font-weight: 600;
            color: ${textColor};
            white-space: nowrap;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0,0,0,0.12);
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
    <div className="relative w-full" style={{ height: '100dvh', background: '#f8f9fa' }}>
      {/* Header */}
      <header
        className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4"
        style={{
          height: '56px',
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid #f0f0f0',
        }}
      >
        <div className="flex flex-col justify-center" style={{ gap: '1px' }}>
          <span
            className="font-bold leading-tight"
            style={{ color: '#111827', fontSize: '17px', letterSpacing: '-0.3px' }}
          >
            혼술맵
          </span>
          <span
            className="leading-tight"
            style={{ color: '#b0b8c1', fontSize: '11px', letterSpacing: '0.1px' }}
          >
            제주 혼술바 실시간
          </span>
        </div>
        <Link
          href="/write"
          className="flex items-center gap-1.5"
          style={{
            padding: '6px 12px',
            fontSize: '13px',
            fontWeight: 500,
            color: '#4b5563',
            border: '1px solid #d1d5db',
            borderRadius: '7px',
            background: '#ffffff',
            letterSpacing: '-0.1px',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          제보하기
        </Link>
      </header>

      {/* Region Filter */}
      <div
        className="absolute z-20 left-0 right-0"
        style={{
          top: '56px',
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #f0f0f0',
        }}
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
            style={{ background: '#f3f4f6' }}
          >
            <span className="text-sm" style={{ color: '#9ca3af' }}>
              지도 로딩 중...
            </span>
          </div>
        )}
      </div>

      {/* FAB buttons */}
      <div
        className="absolute z-30 flex flex-col gap-2"
        style={{ bottom: '100px', right: '16px' }}
      >
        <button
          onClick={handleGps}
          className="w-11 h-11 flex items-center justify-center shadow-lg"
          style={{ background: '#ffffff', borderRadius: '50%', border: '1px solid #e5e7eb' }}
          aria-label="현재 위치"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
            <line x1="12" y1="2" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="22" />
            <line x1="2" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="22" y2="12" />
          </svg>
        </button>
        <button
          onClick={() => setSheetOpen((v) => !v)}
          className="w-11 h-11 flex items-center justify-center shadow-lg"
          style={{ background: '#3B82F6', borderRadius: '50%' }}
          aria-label="목록 보기"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>
      </div>

      {/* Bottom Sheet */}
      <div
        className="absolute left-0 right-0 z-25 overflow-hidden"
        style={{
          bottom: 0,
          height: '340px',
          background: '#ffffff',
          borderTop: '1px solid #e5e7eb',
          borderRadius: '16px 16px 0 0',
          transform: sheetOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s ease',
          boxShadow: sheetOpen ? '0 -4px 20px rgba(0,0,0,0.08)' : 'none',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div style={{ width: '36px', height: '4px', background: '#d1d5db', borderRadius: '2px' }} />
        </div>

        <div className="flex items-center justify-between px-4 py-2">
          <span className="font-semibold text-sm" style={{ color: '#111827' }}>
            가게 목록 {spots.length > 0 && `(${spots.length})`}
          </span>
          <button
            onClick={() => setSheetOpen(false)}
            className="text-sm"
            style={{ color: '#9ca3af' }}
          >
            닫기
          </button>
        </div>

        <div className="overflow-y-auto px-4" style={{ height: '260px' }}>
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <span className="text-sm" style={{ color: '#9ca3af' }}>
                불러오는 중...
              </span>
            </div>
          ) : spots.length === 0 ? (
            <div className="flex items-center justify-center h-24">
              <span className="text-sm" style={{ color: '#9ca3af' }}>
                가게가 없습니다
              </span>
            </div>
          ) : (
            <ul className="divide-y" style={{ borderColor: '#f3f4f6' }}>
              {spots.map((spot) => (
                <li key={spot.id}>
                  <Link
                    href={`/spot/${spot.slug}`}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#111827' }}>
                        {spot.name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                        {spot.address}
                      </p>
                    </div>
                    {spot.latest_story_at && (
                      <span
                        className="text-xs font-medium px-2 py-0.5 ml-2 flex-shrink-0"
                        style={{
                          background: '#EDE9FE',
                          color: '#7C3AED',
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
          style={{ height: '100dvh', background: '#f8f9fa' }}
        >
          <span className="text-sm" style={{ color: '#9ca3af' }}>
            로딩 중...
          </span>
        </div>
      }
    >
      <MapPageInner />
    </Suspense>
  );
}

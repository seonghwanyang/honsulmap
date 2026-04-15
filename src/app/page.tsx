'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import RegionFilter from '@/components/RegionFilter';
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
      };
    };
    __selectSpot?: (spotId: string) => void;
  }
}

interface NaverMap {
  setCenter(latlng: NaverLatLng): void;
  panTo(latlng: NaverLatLng): void;
}
interface NaverLatLng { lat(): number; lng(): number; }
interface NaverPoint { x: number; y: number; }
interface NaverSize { width: number; height: number; }
interface NaverMarker { setMap(map: NaverMap | null): void; }

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

  // Load Naver Map script
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_NAVER_MAP_CLIENT_ID;
    if (!clientId) return;
    if (document.getElementById('naver-map-script')) { setMapReady(true); return; }
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
    mapInstanceRef.current = new window.naver.maps.Map(mapRef.current, {
      center: new window.naver.maps.LatLng(33.3617, 126.5292),
      zoom: 10,
      mapTypeId: 'normal',
    });
  }, [mapReady]);

  // Render pin markers
  useEffect(() => {
    if (!mapInstanceRef.current || !window.naver?.maps) return;

    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    spots.forEach((spot) => {
      const hasStory = !!spot.latest_story_at;
      const gradientBg = hasStory
        ? 'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)'
        : '#d1d5db';
      const tailColor = hasStory ? '#dc2743' : '#d1d5db';

      const content = `
        <div onclick="window.__selectSpot && window.__selectSpot('${spot.id}')"
          style="cursor:pointer;display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2));">
          <div style="width:38px;height:38px;border-radius:50%;background:${gradientBg};padding:${hasStory ? '3px' : '2px'};">
            <div style="width:100%;height:100%;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;">
              🍺
            </div>
          </div>
          <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:9px solid ${tailColor};margin-top:-2px;"></div>
        </div>
      `;

      const marker = new window.naver.maps.Marker({
        position: new window.naver.maps.LatLng(spot.lat, spot.lng),
        map: mapInstanceRef.current!,
        icon: {
          content,
          size: new window.naver.maps.Size(38, 47),
          anchor: new window.naver.maps.Point(19, 47),
        },
      });
      overlaysRef.current.push(marker);
    });
  }, [spots, mapReady]);

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
    ? selectedSpot.stories
        .filter((s: Story) => new Date(s.expires_at).getTime() > Date.now())
        .sort((a: Story, b: Story) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime())
    : [];

  const instagramUrl = selectedSpot?.instagram_id
    ? `https://www.instagram.com/${selectedSpot.instagram_id}/`
    : null;

  return (
    <div className="relative w-full" style={{ height: '100dvh', background: '#f8f9fa' }}>
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 h-14 bg-white/95 backdrop-blur-md border-b border-[#F0F0F0]">
        <div className="flex flex-col justify-center gap-px">
          <span className="font-bold leading-tight text-[17px] tracking-[-0.3px] text-[#111827]">
            혼술맵
          </span>
          <span className="leading-tight text-[11px] tracking-[0.1px] text-[#888888]">
            제주 혼술바 실시간
          </span>
        </div>
        <Link
          href="/write"
          className="flex items-center gap-1.5 border border-gray-300 text-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white no-underline"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          제보하기
        </Link>
      </header>

      {/* Region Filter */}
      <div className="absolute z-20 left-0 right-0 top-14 bg-white/95 backdrop-blur-sm border-b border-[#F0F0F0]">
        <RegionFilter selected={region} onChange={handleRegionChange} />
      </div>


      {/* Map */}
      <div ref={mapRef} id="map" className="absolute inset-0 z-[1]">
        {!mapReady && (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <span className="text-sm text-gray-400">지도 로딩 중...</span>
          </div>
        )}
      </div>

      {/* FAB buttons */}
      <div className="absolute z-30 flex flex-col gap-2" style={{ bottom: '100px', right: '16px' }}>
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
                        style={{ background: '#fef2f2', color: '#dc2743', borderRadius: '999px' }}
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
          transform: selectedSpot ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s ease',
          boxShadow: selectedSpot ? '0 -4px 24px rgba(0,0,0,0.12)' : 'none',
        }}
      >
        {selectedSpot && (
          <>
            {/* Handle + Close */}
            <div className="flex justify-center pt-2 pb-1">
              <div style={{ width: '36px', height: '4px', background: '#d1d5db', borderRadius: '2px' }} />
            </div>

            {/* Spot Info */}
            <div className="px-4 pt-1 pb-3" style={{ borderBottom: '1px solid #f3f4f6' }}>
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
                    style={{ background: '#f3f4f6', color: '#dc2743', borderRadius: '8px', textDecoration: 'none' }}
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
                  {activeStories.map((story: Story) => (
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
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg,#f09433,#dc2743,#bc1888)',
                            padding: '1.5px',
                            flexShrink: 0,
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              borderRadius: '50%',
                              background: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                            }}
                          >
                            🍺
                          </div>
                        </div>
                        <span className="text-xs font-semibold" style={{ color: '#fff' }}>
                          {selectedSpot.name}
                        </span>
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                          {relativeTime(story.posted_at)}
                        </span>
                      </div>
                    </div>
                  ))}
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

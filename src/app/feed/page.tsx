'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import RegionFilter from '@/components/RegionFilter';
import FeedCard from '@/components/FeedCard';
import AdBannerInline from '@/components/AdBannerInline';
import { SpotWithStories } from '@/lib/types';

function FeedPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const region = searchParams.get('region') || 'all';

  const [spots, setSpots] = useState<SpotWithStories[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegionChange = useCallback(
    (r: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (r === 'all') {
        params.delete('region');
      } else {
        params.set('region', r);
      }
      router.push(`/feed?${params.toString()}`);
    },
    [router, searchParams],
  );

  useEffect(() => {
    const fetchSpots = async () => {
      setLoading(true);
      setError(null);
      try {
        const url =
          region && region !== 'all' ? `/api/spots?region=${region}` : '/api/spots';
        const res = await fetch(url);
        if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
        const data: SpotWithStories[] = await res.json();

        const sorted = [...data].sort((a, b) => {
          const aHasStory = !!a.latest_story_at;
          const bHasStory = !!b.latest_story_at;
          if (aHasStory && !bHasStory) return -1;
          if (!aHasStory && bHasStory) return 1;
          if (aHasStory && bHasStory) {
            return (
              new Date(b.latest_story_at!).getTime() -
              new Date(a.latest_story_at!).getTime()
            );
          }
          return a.name.localeCompare(b.name, 'ko');
        });

        setSpots(sorted);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchSpots();
  }, [region]);

  const renderItems = () => {
    const items: React.ReactNode[] = [];
    spots.forEach((spot, idx) => {
      items.push(
        <div key={spot.id} className="masonry-item">
          <FeedCard spot={spot} />
        </div>,
      );
      if ((idx + 1) % 6 === 0 && idx < spots.length - 1) {
        items.push(
          <div key={`ad-${idx}`} className="col-span-2 flex justify-center my-3">
            <AdBannerInline size="320x50" />
          </div>,
        );
      }
    });
    return items;
  };

  return (
    <div style={{ background: '#ffffff', minHeight: '100dvh' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-20 flex items-center px-4"
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
            피드
          </span>
          <span
            className="leading-tight"
            style={{ color: '#b0b8c1', fontSize: '11px', letterSpacing: '0.1px' }}
          >
            제주 혼술바 스토리
          </span>
        </div>
      </header>

      {/* Region Filter */}
      <div
        className="sticky z-10"
        style={{ top: '56px', background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #f0f0f0' }}
      >
        <RegionFilter selected={region} onChange={handleRegionChange} />
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm" style={{ color: '#9ca3af' }}>
              불러오는 중...
            </span>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <span className="text-sm" style={{ color: '#ef4444' }}>
              {error}
            </span>
            <button
              onClick={() => router.refresh()}
              className="text-xs px-3 py-1.5"
              style={{ background: '#f3f4f6', color: '#374151', borderRadius: '6px' }}
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && spots.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm" style={{ color: '#9ca3af' }}>
              등록된 가게가 없습니다
            </span>
          </div>
        )}

        {!loading && !error && spots.length > 0 && (
          <div className="masonry-grid">
            {renderItems()}
          </div>
        )}
      </div>
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <div
          className="w-full flex items-center justify-center"
          style={{ height: '100dvh', background: '#ffffff' }}
        >
          <span className="text-sm" style={{ color: '#9ca3af' }}>
            로딩 중...
          </span>
        </div>
      }
    >
      <FeedPageInner />
    </Suspense>
  );
}

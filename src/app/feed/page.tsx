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

        // Sort: spots with recent stories first, then alphabetical
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

  // Build items with ad slots inserted every 5 cards
  const renderItems = () => {
    const items: React.ReactNode[] = [];
    spots.forEach((spot, idx) => {
      items.push(
        <div key={spot.id} className="mb-4">
          <FeedCard spot={spot} />
        </div>,
      );
      if ((idx + 1) % 5 === 0 && idx < spots.length - 1) {
        items.push(
          <div key={`ad-${idx}`} className="col-span-2 flex justify-center my-2">
            <AdBannerInline size="320x50" />
          </div>,
        );
      }
    });
    return items;
  };

  return (
    <div style={{ background: '#16191E', minHeight: '100dvh', paddingBottom: '72px' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-20 flex items-center px-4"
        style={{ height: '52px', background: '#16191E', borderBottom: '1px solid #2a2d33' }}
      >
        <span className="font-bold text-lg" style={{ color: '#F59E0B' }}>
          제주혼술
        </span>
      </header>

      {/* Region Filter */}
      <div
        className="sticky z-10"
        style={{ top: '52px', background: '#16191E', borderBottom: '1px solid #2a2d33' }}
      >
        <RegionFilter selected={region} onChange={handleRegionChange} />
      </div>

      {/* Content */}
      <div className="px-3 pt-4">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm" style={{ color: '#888888' }}>
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
              style={{ background: '#2a2d33', color: '#ffffff', borderRadius: '6px' }}
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && spots.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm" style={{ color: '#888888' }}>
              등록된 가게가 없습니다
            </span>
          </div>
        )}

        {!loading && !error && spots.length > 0 && (
          <div
            className="masonry-grid"
            style={{
              columns: 2,
              columnGap: '12px',
            }}
          >
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
          style={{ height: '100dvh', background: '#16191E' }}
        >
          <span className="text-sm" style={{ color: '#888888' }}>
            로딩 중...
          </span>
        </div>
      }
    >
      <FeedPageInner />
    </Suspense>
  );
}

'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import RegionFilter from '@/components/RegionFilter';
import NativeCard from '@/components/ads/NativeCard';
import { StoryWithSpot } from '@/lib/types';
import { relativeTime, getRegionLabel } from '@/lib/utils';

function StoryCard({ story }: { story: StoryWithSpot }) {
  const isVideo = story.media_type === 'video';

  return (
    <Link href={`/spot/${story.spot.slug}`} className="block rounded-xl overflow-hidden bg-gray-100">
      <div className="relative aspect-[4/5]">
        {isVideo ? (
          <video
            src={story.media_url}
            poster={story.thumbnail_url || undefined}
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={story.thumbnail_url || story.media_url}
            alt={story.spot.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )}
        {isVideo && (
          <div className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-black/40">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
              <polygon points="5,3 19,12 5,21" />
            </svg>
          </div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/60 to-transparent">
          <p className="text-white text-sm font-semibold truncate leading-tight">
            {story.spot.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-white/70 text-xs">
              {getRegionLabel(story.spot.region)}
            </span>
            <span className="text-white/40 text-xs">·</span>
            <span className="text-white/70 text-xs">
              {relativeTime(story.posted_at)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function FeedPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const region = searchParams.get('region') || 'all';

  const [stories, setStories] = useState<StoryWithSpot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Re-render every 30s to keep relative times accurate
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

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
    const fetchStories = async () => {
      setLoading(true);
      setError(null);
      try {
        const url =
          region && region !== 'all'
            ? `/api/stories/latest?region=${region}`
            : '/api/stories/latest';
        console.log('[FEED] fetching', url);
        const res = await fetch(url);
        console.log('[FEED] response', { status: res.status, ok: res.ok });
        if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
        const data: StoryWithSpot[] = await res.json();
        console.log('[FEED] stories count:', data.length, data.slice(0, 2));
        setStories(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        console.error('[FEED] fetch failed:', msg);
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    fetchStories();
  }, [region]);

  const renderItems = () => {
    const items: React.ReactNode[] = [];
    stories.forEach((story, idx) => {
      items.push(
        <div key={story.id} className="feed-item">
          <StoryCard story={story} />
        </div>,
      );
      if ((idx + 1) % 6 === 0 && idx < stories.length - 1) {
        items.push(
          <div key={`ad-${idx}`} className="feed-item">
            <NativeCard />
          </div>,
        );
      }
    });
    return items;
  };

  return (
    <div className="bg-white min-h-dvh">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center px-4 h-14 bg-white/95 backdrop-blur-md border-b border-[#F0F0F0]">
        <div className="flex flex-col justify-center gap-px">
          <span className="font-bold leading-tight text-[17px] tracking-[-0.3px] text-[#111827]">
            피드
          </span>
          <span className="leading-tight text-[11px] tracking-[0.1px] text-[#888888]">
            제주 혼술바 스토리
          </span>
        </div>
      </header>

      {/* Region Filter */}
      <div className="sticky top-14 z-10 bg-white/95 backdrop-blur-sm border-b border-[#F0F0F0]">
        <RegionFilter selected={region} onChange={handleRegionChange} />
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm text-gray-400">불러오는 중...</span>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <span className="text-sm text-red-500">{error}</span>
            <button
              onClick={() => router.refresh()}
              className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md"
            >
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && stories.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm text-gray-400">활성 스토리가 없습니다</span>
          </div>
        )}

        {!loading && !error && stories.length > 0 && (
          <div className="masonry-grid">{renderItems()}</div>
        )}
      </div>
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full flex items-center justify-center min-h-dvh bg-white">
          <span className="text-sm text-gray-400">로딩 중...</span>
        </div>
      }
    >
      <FeedPageInner />
    </Suspense>
  );
}

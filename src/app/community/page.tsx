'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AdBannerInline from '@/components/AdBannerInline';
import { Post, POST_CATEGORIES, PostCategory } from '@/lib/types';
import { relativeTime, getCategoryLabel } from '@/lib/utils';

// Inline PostItem since component may not exist yet
function PostItem({ post }: { post: Post }) {
  return (
    <Link href={`/post/${post.id}`} className="block">
      <div
        className="px-4 py-3"
        style={{ borderBottom: '1px solid #2a2d33' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-xs px-2 py-0.5 font-medium"
            style={{
              background:
                post.category === 'status'
                  ? '#14532d'
                  : post.category === 'review'
                  ? '#1e3a5f'
                  : post.category === 'tip'
                  ? '#3b2a00'
                  : '#2a2d33',
              color:
                post.category === 'status'
                  ? '#4ade80'
                  : post.category === 'review'
                  ? '#60a5fa'
                  : post.category === 'tip'
                  ? '#fbbf24'
                  : '#aaaaaa',
              borderRadius: '4px',
            }}
          >
            {getCategoryLabel(post.category)}
          </span>
          {post.spot && (
            <span className="text-xs truncate" style={{ color: '#888888' }}>
              {post.spot.name}
            </span>
          )}
        </div>
        <p className="font-medium text-sm leading-snug line-clamp-2" style={{ color: '#ffffff' }}>
          {post.title}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs" style={{ color: '#888888' }}>
            {post.nickname}
          </span>
          <span className="text-xs" style={{ color: '#555555' }}>
            {relativeTime(post.created_at)}
          </span>
          <span className="text-xs ml-auto" style={{ color: '#888888' }}>
            ♥ {post.like_count} · 💬 {post.comment_count}
          </span>
        </div>
      </div>
    </Link>
  );
}

function CommunityPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = (searchParams.get('category') || 'all') as PostCategory | 'all';

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const LIMIT = 20;

  const handleCategoryChange = useCallback(
    (cat: PostCategory | 'all') => {
      const params = new URLSearchParams();
      if (cat !== 'all') params.set('category', cat);
      router.push(`/community?${params.toString()}`);
      // Reset state on category change
      setPosts([]);
      setOffset(0);
      setHasMore(true);
    },
    [router],
  );

  const fetchPosts = useCallback(
    async (currentOffset: number, reset = false) => {
      if (loading || (!hasMore && !reset)) return;
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: String(LIMIT),
          offset: String(currentOffset),
        });
        if (category !== 'all') params.set('category', category);
        const res = await fetch(`/api/posts?${params.toString()}`);
        if (!res.ok) throw new Error(`서버 오류: ${res.status}`);
        const data: Post[] = await res.json();
        setPosts((prev) => (reset ? data : [...prev, ...data]));
        setHasMore(data.length === LIMIT);
        setOffset(currentOffset + data.length);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '알 수 없는 오류';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [category, hasMore, loading],
  );

  // Reset and fetch when category changes
  useEffect(() => {
    setPosts([]);
    setOffset(0);
    setHasMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // Initial fetch
  useEffect(() => {
    fetchPosts(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  // Infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          fetchPosts(offset);
        }
      },
      { threshold: 0.1 },
    );
    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }
    return () => observerRef.current?.disconnect();
  }, [fetchPosts, hasMore, loading, offset]);

  // Build list with ad slots every 5 items
  const renderPosts = () => {
    const items: React.ReactNode[] = [];
    posts.forEach((post, idx) => {
      items.push(<PostItem key={post.id} post={post} />);
      if ((idx + 1) % 5 === 0 && idx < posts.length - 1) {
        items.push(
          <div key={`ad-${idx}`} className="flex justify-center py-2">
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
        <span className="font-bold text-lg" style={{ color: '#ffffff' }}>
          커뮤니티
        </span>
      </header>

      {/* Category filter chips */}
      <div
        className="sticky z-10 flex gap-2 overflow-x-auto px-3 py-2"
        style={{
          top: '52px',
          background: '#16191E',
          borderBottom: '1px solid #2a2d33',
          scrollbarWidth: 'none',
        }}
      >
        {POST_CATEGORIES.map((cat) => {
          const isSelected = category === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => handleCategoryChange(cat.value as PostCategory | 'all')}
              className="flex-shrink-0 px-3 py-1 text-sm font-medium transition-colors"
              style={{
                borderRadius: '999px',
                background: isSelected ? '#F59E0B' : '#2a2d33',
                color: isSelected ? '#111111' : '#aaaaaa',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Popular Carousel placeholder */}
      <div
        className="px-4 py-3"
        style={{ borderBottom: '1px solid #2a2d33' }}
      >
        <p className="text-xs font-semibold mb-2" style={{ color: '#888888' }}>
          인기 게시글
        </p>
        <div
          className="flex items-center justify-center"
          style={{
            height: '64px',
            background: '#2a2d33',
            borderRadius: '8px',
            color: '#555555',
            fontSize: '12px',
          }}
        >
          인기 게시글 영역
        </div>
      </div>

      {/* Contribution Ranking placeholder */}
      <div
        className="px-4 py-3"
        style={{ borderBottom: '1px solid #2a2d33' }}
      >
        <p className="text-xs font-semibold mb-2" style={{ color: '#888888' }}>
          이번 주 기여자
        </p>
        <div
          className="flex items-center justify-center"
          style={{
            height: '48px',
            background: '#2a2d33',
            borderRadius: '8px',
            color: '#555555',
            fontSize: '12px',
          }}
        >
          기여자 랭킹 영역
        </div>
      </div>

      {/* Post list */}
      <div>
        {!loading && !error && posts.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm" style={{ color: '#888888' }}>
              게시글이 없습니다
            </span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <span className="text-sm" style={{ color: '#ef4444' }}>
              {error}
            </span>
            <button
              onClick={() => fetchPosts(0, true)}
              className="text-xs px-3 py-1.5"
              style={{ background: '#2a2d33', color: '#ffffff', borderRadius: '6px' }}
            >
              다시 시도
            </button>
          </div>
        )}

        {renderPosts()}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} style={{ height: '1px' }} />

        {loading && (
          <div className="flex items-center justify-center py-6">
            <span className="text-sm" style={{ color: '#888888' }}>
              불러오는 중...
            </span>
          </div>
        )}

        {!hasMore && posts.length > 0 && (
          <div className="flex items-center justify-center py-4">
            <span className="text-xs" style={{ color: '#555555' }}>
              모든 게시글을 불러왔습니다
            </span>
          </div>
        )}
      </div>

      {/* FABWrite */}
      <Link
        href="/write"
        className="fixed z-30 w-14 h-14 flex items-center justify-center text-2xl shadow-xl"
        style={{
          bottom: '72px',
          right: '16px',
          background: '#F59E0B',
          borderRadius: '50%',
          color: '#111111',
        }}
        aria-label="글쓰기"
      >
        ✏️
      </Link>
    </div>
  );
}

export default function CommunityPage() {
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
      <CommunityPageInner />
    </Suspense>
  );
}

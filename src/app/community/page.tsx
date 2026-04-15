'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AdBannerInline from '@/components/AdBannerInline';
import { Post, POST_CATEGORIES, PostCategory } from '@/lib/types';
import { relativeTime, getCategoryLabel } from '@/lib/utils';

const categoryBadgeStyle: Record<string, { bg: string; text: string }> = {
  status: { bg: '#dcfce7', text: '#15803d' },
  review: { bg: '#dbeafe', text: '#1d4ed8' },
  tip: { bg: '#fef3c7', text: '#92400e' },
  free: { bg: '#f3f4f6', text: '#4b5563' },
};

function PostItem({ post }: { post: Post }) {
  const style = categoryBadgeStyle[post.category] || categoryBadgeStyle.free;

  return (
    <Link href={`/post/${post.id}`} className="block">
      <div
        className="px-4 py-3.5"
        style={{ borderBottom: '1px solid #f3f4f6' }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className="text-xs px-2 py-0.5 font-medium"
            style={{
              background: style.bg,
              color: style.text,
              borderRadius: '4px',
            }}
          >
            {getCategoryLabel(post.category)}
          </span>
          {post.spot && (
            <span className="text-xs truncate" style={{ color: '#9ca3af' }}>
              {post.spot.name}
            </span>
          )}
        </div>
        <p className="font-medium text-sm leading-snug line-clamp-2" style={{ color: '#111827' }}>
          {post.title}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs font-medium" style={{ color: '#6b7280' }}>
            {post.nickname}
          </span>
          <span className="text-xs" style={{ color: '#d1d5db' }}>|</span>
          <span className="text-xs" style={{ color: '#9ca3af' }}>
            {relativeTime(post.created_at)}
          </span>
          <span className="text-xs ml-auto flex items-center gap-2" style={{ color: '#9ca3af' }}>
            <span>&#9825; {post.like_count}</span>
            <span>&#128172; {post.comment_count}</span>
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

  useEffect(() => {
    setPosts([]);
    setOffset(0);
    setHasMore(true);
  }, [category]);

  useEffect(() => {
    fetchPosts(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

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
    <div style={{ background: '#ffffff', minHeight: '100dvh' }}>
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between px-4 h-14 bg-white/95 backdrop-blur-md border-b border-[#F0F0F0]">
        <div className="flex flex-col justify-center gap-px">
          <span className="font-bold leading-tight text-[17px] tracking-[-0.3px] text-[#111827]">
            커뮤니티
          </span>
          <span className="leading-tight text-[11px] tracking-[0.1px] text-[#888888]">
            자유롭게 이야기해요
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 flex items-center justify-center text-gray-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <Link
            href="/write"
            className="flex items-center gap-1.5 border border-gray-300 text-gray-600 rounded-lg px-3 py-1.5 text-sm bg-white no-underline"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-70">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            글쓰기
          </Link>
        </div>
      </header>

      {/* Category filter chips */}
      <div className="sticky top-14 z-10 flex overflow-x-auto hide-scrollbar gap-[7px] px-4 py-[9px] bg-white/95 backdrop-blur-sm border-b border-[#F0F0F0]">
        {POST_CATEGORIES.map((cat) => {
          const isSelected = category === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => handleCategoryChange(cat.value as PostCategory | 'all')}
              className={`flex-shrink-0 rounded-full py-[5px] px-[14px] text-[13px] leading-[1.4] tracking-[-0.1px] transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-[#111827] text-white font-semibold border border-[#111827]'
                  : 'bg-white text-gray-500 font-normal border border-gray-200'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Contribution Ranking Card */}
      <div
        className="mx-4 mt-3 p-3"
        style={{
          background: '#f8f9fa',
          borderRadius: '12px',
          border: '1px solid #e5e7eb',
        }}
      >
        <p className="text-xs font-semibold mb-2" style={{ color: '#6b7280' }}>
          기여 랭킹 TOP 5 · 최근 30일
        </p>
        <div
          className="flex items-center justify-center"
          style={{
            height: '40px',
            color: '#9ca3af',
            fontSize: '12px',
          }}
        >
          랭킹 데이터 준비 중
        </div>
      </div>

      {/* Post list */}
      <div className="mt-2">
        {!loading && !error && posts.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm" style={{ color: '#9ca3af' }}>
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
              style={{ background: '#f3f4f6', color: '#374151', borderRadius: '6px' }}
            >
              다시 시도
            </button>
          </div>
        )}

        {renderPosts()}

        <div ref={sentinelRef} style={{ height: '1px' }} />

        {loading && (
          <div className="flex items-center justify-center py-6">
            <span className="text-sm" style={{ color: '#9ca3af' }}>
              불러오는 중...
            </span>
          </div>
        )}

        {!hasMore && posts.length > 0 && (
          <div className="flex items-center justify-center py-4">
            <span className="text-xs" style={{ color: '#d1d5db' }}>
              모든 게시글을 불러왔습니다
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CommunityPage() {
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
      <CommunityPageInner />
    </Suspense>
  );
}

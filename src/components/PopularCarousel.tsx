'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Post } from '@/lib/types';

export default function PopularCarousel() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/posts?sort=popular&limit=10')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setPosts(Array.isArray(data) ? data : data.posts ?? []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="px-4 py-3">
        <div className="flex gap-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0"
              style={{
                width: '140px',
                height: '72px',
                background: '#2a2d33',
                borderRadius: '8px',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (posts.length === 0) return null;

  return (
    <div className="py-3">
      <h3 className="px-4 text-sm font-semibold mb-2" style={{ color: '#ffffff' }}>
        인기글
      </h3>
      <div
        className="flex gap-3 overflow-x-auto px-4 pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/post/${post.id}`}
            className="flex-shrink-0 p-3 flex flex-col justify-between"
            style={{
              width: '160px',
              minHeight: '80px',
              background: '#1e2127',
              borderRadius: '8px',
              border: '1px solid #2a2d33',
              textDecoration: 'none',
            }}
          >
            <p
              className="text-xs font-medium line-clamp-2 leading-relaxed"
              style={{ color: '#e0e0e0' }}
            >
              {post.title}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs" style={{ color: '#888888' }}>
                ♡ {post.like_count}
              </span>
              <span className="text-xs" style={{ color: '#888888' }}>
                💬 {post.comment_count}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

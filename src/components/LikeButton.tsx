'use client';

import { useState } from 'react';
import { TargetType } from '@/lib/types';
import { getFingerprint } from '@/lib/utils';

interface LikeButtonProps {
  targetType: TargetType;
  targetId: string;
  initialCount: number;
}

function getApiPath(targetType: TargetType, targetId: string): string {
  if (targetType === 'spot') return `/api/spots/${targetId}/like`;
  if (targetType === 'post') return `/api/posts/${targetId}/like`;
  return `/api/comments/${targetId}/like`;
}

export default function LikeButton({ targetType, targetId, initialCount }: LikeButtonProps) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    const fingerprint = getFingerprint();
    if (!fingerprint) return;

    setLoading(true);
    try {
      const res = await fetch(getApiPath(targetType, targetId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.toggled === false) {
          // already liked - server rejected duplicate
          return;
        }
        const next = !liked;
        setLiked(next);
        setCount((c) => (next ? c + 1 : c - 1));
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1 text-sm transition-opacity"
      style={{
        color: liked ? '#F59E0B' : '#888888',
        opacity: loading ? 0.6 : 1,
        cursor: loading ? 'not-allowed' : 'pointer',
        background: 'none',
        border: 'none',
        padding: '4px 8px',
        borderRadius: '999px',
      }}
    >
      <span>{liked ? '♥' : '♡'}</span>
      <span>{count}</span>
    </button>
  );
}

'use client';

import { useState } from 'react';
import { getFingerprint } from '@/lib/utils';

interface MoodVoteProps {
  spotId: string;
  initialUp: number;
  initialDown: number;
}

type VoteType = 'up' | 'down' | null;

export default function MoodVote({ spotId, initialUp, initialDown }: MoodVoteProps) {
  const [vote, setVote] = useState<VoteType>(null);
  const [upCount, setUpCount] = useState(initialUp);
  const [downCount, setDownCount] = useState(initialDown);
  const [loading, setLoading] = useState(false);

  async function handleVote(type: 'up' | 'down') {
    if (loading) return;
    const fingerprint = getFingerprint();
    if (!fingerprint) return;

    const nextVote: VoteType = vote === type ? null : type;

    setLoading(true);
    try {
      const res = await fetch(`/api/spots/${spotId}/mood`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: nextVote, fingerprint }),
      });

      if (res.ok) {
        // Adjust counts optimistically
        if (vote === 'up') setUpCount((c) => c - 1);
        if (vote === 'down') setDownCount((c) => c - 1);
        if (nextVote === 'up') setUpCount((c) => c + 1);
        if (nextVote === 'down') setDownCount((c) => c + 1);
        setVote(nextVote);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleVote('up')}
        disabled={loading}
        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium transition-colors"
        style={{
          borderRadius: '999px',
          background: vote === 'up' ? '#F59E0B' : '#2a2d33',
          color: vote === 'up' ? '#ffffff' : '#888888',
          border: vote === 'up' ? '1px solid #F59E0B' : '1px solid #3a3d43',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        ⬆ {upCount}
      </button>
      <button
        onClick={() => handleVote('down')}
        disabled={loading}
        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium transition-colors"
        style={{
          borderRadius: '999px',
          background: vote === 'down' ? '#EF4444' : '#2a2d33',
          color: vote === 'down' ? '#ffffff' : '#888888',
          border: vote === 'down' ? '1px solid #EF4444' : '1px solid #3a3d43',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        ⬇ {downCount}
      </button>
    </div>
  );
}

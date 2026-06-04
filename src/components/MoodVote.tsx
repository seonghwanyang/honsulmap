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

    setLoading(true);
    try {
      // Send the button that was pressed; the server decides toggle/switch/
      // cancel from the prior vote and returns the authoritative counts, so
      // the client just mirrors them (no optimistic drift).
      const res = await fetch(`/api/spots/${spotId}/mood`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: type, fingerprint }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          mood_up: number;
          mood_down: number;
          vote: VoteType;
        };
        setUpCount(data.mood_up);
        setDownCount(data.mood_down);
        setVote(data.vote);
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
          background: vote === 'up' ? '#A7F3D0' : '#2a2d33',
          color: vote === 'up' ? '#065F46' : '#888888',
          border: vote === 'up' ? '1px solid #6EE7B7' : '1px solid #3a3d43',
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
          background: vote === 'down' ? '#FECDD3' : '#2a2d33',
          color: vote === 'down' ? '#9F1239' : '#888888',
          border: vote === 'down' ? '1px solid #FDA4AF' : '1px solid #3a3d43',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        ⬇ {downCount}
      </button>
    </div>
  );
}

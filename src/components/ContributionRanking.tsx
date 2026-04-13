'use client';

import { useState, useEffect } from 'react';
import { ContributionRanking as RankingType } from '@/lib/types';

export default function ContributionRanking() {
  const [open, setOpen] = useState(false);
  const [rankings, setRankings] = useState<RankingType[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  async function fetchRankings() {
    if (fetched) return;
    setLoading(true);
    try {
      const res = await fetch('/api/rankings?limit=50');
      if (res.ok) {
        const data = await res.json();
        setRankings(Array.isArray(data) ? data : data.rankings ?? []);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) fetchRankings();
  }

  const MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

  return (
    <div
      className="mx-4 my-3 rounded-lg overflow-hidden"
      style={{ background: '#1e2127', border: '1px solid #2a2d33' }}
    >
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <span className="text-sm font-semibold" style={{ color: '#ffffff' }}>
          🏆 기여 랭킹
        </span>
        <span className="text-xs" style={{ color: '#888888' }}>
          {open ? '▲ 접기' : 'TOP 50 보기 ▼'}
        </span>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid #2a2d33' }}>
          {loading ? (
            <p className="text-sm text-center py-4" style={{ color: '#888888' }}>
              불러오는 중...
            </p>
          ) : rankings.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: '#888888' }}>
              데이터가 없습니다
            </p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {rankings.map((item, idx) => (
                <div
                  key={item.nickname}
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ borderBottom: '1px solid #2a2d33' }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm w-6 text-center" style={{ color: '#888888' }}>
                      {MEDAL[idx] ?? `${idx + 1}`}
                    </span>
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#e0e0e0' }}>
                        {item.nickname}
                      </p>
                      <p className="text-xs" style={{ color: '#888888' }}>
                        게시글 {item.post_count}개
                      </p>
                    </div>
                  </div>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: '#F59E0B' }}
                  >
                    {item.score}점
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

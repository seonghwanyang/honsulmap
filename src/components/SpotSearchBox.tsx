'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SpotWithStories } from '@/lib/types';

interface Props {
  spots: SpotWithStories[];
  onPick: (spot: SpotWithStories) => void;
}

export default function SpotSearchBox({ spots, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside the component
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return spots
      .filter((s) => {
        const name = s.name.toLowerCase();
        const addr = (s.address || '').toLowerCase();
        const ig = (s.instagram_id || '').toLowerCase();
        return name.includes(q) || addr.includes(q) || ig.includes(q);
      })
      .sort((a, b) => {
        // Exact/starts-with hits beat substring
        const qa = a.name.toLowerCase();
        const qb = b.name.toLowerCase();
        const aStart = qa.startsWith(q) ? 0 : 1;
        const bStart = qb.startsWith(q) ? 0 : 1;
        if (aStart !== bStart) return aStart - bStart;
        // Story-active first within each tier
        const aStory = a.latest_story_at ? 0 : 1;
        const bStory = b.latest_story_at ? 0 : 1;
        return aStory - bStory;
      })
      .slice(0, 8);
  }, [query, spots]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  function pick(spot: SpotWithStories) {
    onPick(spot);
    setOpen(false);
    setQuery('');
  }

  return (
    <div
      ref={wrapRef}
      className="absolute z-30 left-1/2"
      style={{
        // header (56) + region filter (~40) + spot-request banner (~52)
        // + breathing gap (~12) ⇒ sits slightly off the top overlay's
        // bottom boundary so it doesn't feel glued to the line.
        top: 160,
        transform: 'translateX(-50%)',
        width: 'min(92vw, 440px)',
      }}
    >
      <div
        className="flex items-center"
        style={{
          background: '#ffffff',
          borderRadius: 999,
          padding: '8px 14px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
          border: '1px solid #e5e7eb',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (!open && e.key !== 'Escape') setOpen(true);
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setHighlight((h) => Math.min(h + 1, Math.max(0, results.length - 1)));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (e.key === 'Enter') {
              if (results[highlight]) pick(results[highlight]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          placeholder="가게 이름·주소 검색"
          className="flex-1 outline-none bg-transparent"
          style={{ fontSize: 13, color: '#111827' }}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setOpen(true);
            }}
            aria-label="지우기"
            style={{ color: '#9ca3af', padding: 2, flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {open && query.trim() && (
        <div
          style={{
            marginTop: 6,
            background: '#ffffff',
            borderRadius: 12,
            boxShadow: '0 8px 28px rgba(0,0,0,0.12)',
            border: '1px solid #e5e7eb',
            maxHeight: '60vh',
            overflowY: 'auto',
          }}
        >
          {results.length === 0 ? (
            <div className="px-4 py-3 text-xs" style={{ color: '#9ca3af' }}>
              검색 결과가 없습니다
            </div>
          ) : (
            <ul>
              {results.map((s, i) => (
                <li key={s.id}>
                  <button
                    onClick={() => pick(s)}
                    onMouseEnter={() => setHighlight(i)}
                    className="w-full text-left flex items-center gap-2 px-4 py-2.5"
                    style={{
                      background: i === highlight ? '#f8f9fa' : '#ffffff',
                      borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
                    }}
                  >
                    {s.latest_story_at && (
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: '#7C3AED',
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div
                        style={{
                          fontSize: 13,
                          color: '#111827',
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s.name}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: '#9ca3af',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {s.address || ''}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

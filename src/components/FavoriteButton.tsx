'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { useUser } from '@/lib/useUser';
import { track } from '@/lib/analytics';

// 찜(favorite): login-only. Parent owns the login modal (onNeedLogin).
//
// Nudge logic: show "찜하고 새 소식·혜택 받아보세요" to users who haven't favorited
// anything yet — once per session, lifetime cap NUDGE_MAX, and never again once
// they've favorited at least one spot. Rendered via a portal with position:fixed
// so no ancestor's overflow can clip it.
const NUDGE_COUNT_KEY = 'fav_nudge_count';
const NUDGE_SESSION_KEY = 'fav_nudge_session';
const FAV_USED_KEY = 'fav_used';
const NUDGE_MAX = 3;

export default function FavoriteButton({
  spotId,
  onNeedLogin,
  variant = 'pill',
}: {
  spotId: string;
  onNeedLogin: () => void;
  variant?: 'pill' | 'icon';
}) {
  const { user } = useUser();
  const [fav, setFav] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nudgePos, setNudgePos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // Initial favorited state for the logged-in user.
  useEffect(() => {
    if (!user) {
      setFav(false);
      return;
    }
    const sb = createBrowserSupabase();
    let alive = true;
    sb.from('favorites')
      .select('spot_id')
      .eq('user_id', user.id)
      .eq('spot_id', spotId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setFav(!!data);
      });
    return () => {
      alive = false;
    };
  }, [user, spotId]);

  // Nudge: once/session, lifetime cap, stop once they've ever favorited.
  useEffect(() => {
    if (typeof window === 'undefined' || !btnRef.current) return;
    try {
      if (localStorage.getItem(FAV_USED_KEY)) return;
      if (Number(localStorage.getItem(NUDGE_COUNT_KEY) || '0') >= NUDGE_MAX) return;
      if (sessionStorage.getItem(NUDGE_SESSION_KEY)) return;
    } catch {
      return;
    }
    const r = btnRef.current.getBoundingClientRect();
    const left = Math.min(Math.max(r.left + r.width / 2, 124), window.innerWidth - 124);
    setNudgePos({ top: r.bottom + 8, left });
    try {
      sessionStorage.setItem(NUDGE_SESSION_KEY, '1');
      localStorage.setItem(NUDGE_COUNT_KEY, String(Number(localStorage.getItem(NUDGE_COUNT_KEY) || '0') + 1));
    } catch {
      /* ignore */
    }
    const dismiss = () => setNudgePos(null);
    const t = window.setTimeout(dismiss, 5000);
    window.addEventListener('pointerdown', dismiss, { once: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('pointerdown', dismiss);
    };
  }, []);

  const toggle = async () => {
    if (!user) {
      onNeedLogin();
      return;
    }
    if (busy) return;
    setBusy(true);
    setNudgePos(null);
    const sb = createBrowserSupabase();
    try {
      if (fav) {
        await sb.from('favorites').delete().eq('user_id', user.id).eq('spot_id', spotId);
        setFav(false);
      } else {
        await sb.from('favorites').insert({ user_id: user.id, spot_id: spotId });
        setFav(true);
        track('favorite_added', { spot_id: spotId });
        try {
          localStorage.setItem(FAV_USED_KEY, '1');
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* best-effort */
    } finally {
      setBusy(false);
    }
  };

  const nudge =
    nudgePos && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="status"
            style={{
              position: 'fixed',
              top: nudgePos.top,
              left: nudgePos.left,
              transform: 'translateX(-50%)',
              maxWidth: 'min(80vw, 240px)',
              whiteSpace: 'nowrap',
              background: '#111827',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              padding: '7px 11px',
              borderRadius: 9,
              boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
              pointerEvents: 'none',
              zIndex: 10000,
            }}
          >
            찜하고 새 소식·혜택 받아보세요
          </div>,
          document.body,
        )
      : null;

  if (variant === 'icon') {
    return (
      <>
        <button
          ref={btnRef}
          onClick={toggle}
          aria-pressed={fav}
          aria-label="찜하기"
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center"
          style={{
            background: fav ? '#fff7ed' : '#f3f4f6',
            color: fav ? '#ea580c' : '#9ca3af',
            borderRadius: '50%',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
        {nudge}
      </>
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-pressed={fav}
        aria-label="찜하기"
        className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium"
        style={{
          background: fav ? '#fff7ed' : '#f8f9fa',
          borderRadius: '10px',
          color: fav ? '#ea580c' : '#6b7280',
          border: fav ? '1.5px solid #fdba74' : '1.5px solid #e5e7eb',
          cursor: 'pointer',
        }}
      >
        <span>{fav ? '★' : '☆'}</span>
        <span>찜</span>
      </button>
      {nudge}
    </>
  );
}

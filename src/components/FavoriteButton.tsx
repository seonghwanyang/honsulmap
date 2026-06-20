'use client';

import { useEffect, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { useUser } from '@/lib/useUser';
import { track } from '@/lib/analytics';

// 찜(favorite): login-only. The parent owns the login modal and passes
// onNeedLogin (so we don't stack a second modal). Toggling writes directly to
// the `favorites` table under RLS (user owns their own rows). A one-time,
// dismiss-on-any-tap nudge gently explains the value.
const NUDGE_KEY = 'fav_nudge_seen';

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
  const [nudge, setNudge] = useState(false);

  // Load initial favorited state for the logged-in user.
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

  // One-time gentle nudge — disappears on any tap (or after 5s), shown once ever.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem(NUDGE_KEY)) return;
    } catch {
      return;
    }
    setNudge(true);
    const dismiss = () => {
      setNudge(false);
      try {
        localStorage.setItem(NUDGE_KEY, '1');
      } catch {
        /* ignore */
      }
    };
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
    const sb = createBrowserSupabase();
    try {
      if (fav) {
        await sb.from('favorites').delete().eq('user_id', user.id).eq('spot_id', spotId);
        setFav(false);
      } else {
        await sb.from('favorites').insert({ user_id: user.id, spot_id: spotId });
        setFav(true);
        track('favorite_added', { spot_id: spotId });
      }
    } catch {
      /* best-effort */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {variant === 'icon' ? (
        <button
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
      ) : (
        <button
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
      )}
      {nudge && (
        <div
          role="status"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap',
            background: '#111827',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            padding: '7px 11px',
            borderRadius: 9,
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
            pointerEvents: 'none',
            zIndex: 50,
          }}
        >
          찜하고 새 소식·혜택 받아보세요
          <span
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid #111827',
            }}
          />
        </div>
      )}
    </div>
  );
}

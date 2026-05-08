'use client';

import { useEffect, useRef } from 'react';
import { track, type PageId } from '@/lib/analytics';

// Tracks the time the user spent on a top-level page. Flushes once on the
// first of: visibilitychange→hidden, beforeunload, or unmount. Per Phase 1
// §4, the map page does not call this — its dwell is captured per-spot via
// spot_panel_dwell.
export function usePageDwell(page: PageId, pathId: string): void {
  const startRef = useRef<number>(Date.now());
  const hasFlushedRef = useRef<boolean>(false);

  useEffect(() => {
    startRef.current = Date.now();
    hasFlushedRef.current = false;

    const flush = () => {
      if (hasFlushedRef.current) return;
      hasFlushedRef.current = true;
      const dwell_ms = Date.now() - startRef.current;
      track('page_dwell', { page, path_id: pathId, dwell_ms });
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', flush);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', flush);
      flush();
    };
  }, [page, pathId]);
}

'use client';

import { useEffect } from 'react';
import {
  resetScrollDepthFor,
  shouldFireScrollDepth,
  track,
  type PageId,
  type ScrollDepth,
} from '@/lib/analytics';

const TIERS: ScrollDepth[] = [25, 50, 75, 100];

export function useScrollDepth(page: PageId, pathId: string): void {
  useEffect(() => {
    // Fresh state per (page, pathId) so route navigation re-arms each tier.
    resetScrollDepthFor(page, pathId);

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const clientHeight = window.innerHeight || doc.clientHeight;
      const scrollHeight = doc.scrollHeight;
      if (scrollHeight <= clientHeight) return;
      const ratio = (scrollTop + clientHeight) / scrollHeight;
      const pct = Math.min(100, Math.max(0, ratio * 100));
      for (const tier of TIERS) {
        if (pct >= tier && shouldFireScrollDepth(page, pathId, tier)) {
          track('scroll_depth', { page, path_id: pathId, depth: tier });
        }
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // Fire once on mount in case the page is already scrolled (back-nav).
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [page, pathId]);
}

'use client';

import { useEffect, type RefObject } from 'react';
import {
  shouldFireOnceForStory,
  track,
  type StorySurface,
} from '@/lib/analytics';

interface ImpressionPayload {
  story_id: string;
  spot_id: string;
  region?: string;
  category?: string;
  surface: StorySurface;
}

export function useStoryImpression(
  ref: RefObject<HTMLElement | null>,
  payload: ImpressionPayload,
): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.intersectionRatio < 0.5) continue;
          if (!shouldFireOnceForStory('story_impression', payload.story_id)) {
            observer.disconnect();
            return;
          }
          track('story_impression', payload);
          observer.disconnect();
          return;
        }
      },
      { threshold: 0.5, rootMargin: '0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, payload]);
}

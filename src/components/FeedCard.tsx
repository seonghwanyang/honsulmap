import Link from 'next/link';
import Image from 'next/image';
import { Spot, Story } from '@/lib/types';
import { getCategoryLabel, getRegionLabel } from '@/lib/utils';

interface FeedCardProps {
  spot: Spot & { stories: Story[]; latest_story_at: string | null };
}

function hasRecentStory(latestStoryAt: string | null): boolean {
  if (!latestStoryAt) return false;
  const diff = Date.now() - new Date(latestStoryAt).getTime();
  return diff < 24 * 60 * 60 * 1000;
}

export default function FeedCard({ spot }: FeedCardProps) {
  const thumbnail =
    spot.stories[0]?.thumbnail_url ||
    spot.stories[0]?.media_url ||
    spot.image_urls?.[0] ||
    null;

  const recentStories = spot.stories.filter((s) => {
    const diff = Date.now() - new Date(s.posted_at).getTime();
    return diff < 24 * 60 * 60 * 1000;
  });

  const showBadge = hasRecentStory(spot.latest_story_at) && recentStories.length > 0;

  return (
    <Link href={`/spot/${spot.slug}`} className="block" style={{ borderRadius: '8px', overflow: 'hidden' }}>
      <div
        className="relative"
        style={{ aspectRatio: '4/3', background: '#2a2d33', borderRadius: '8px', overflow: 'hidden' }}
      >
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt={spot.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 33vw"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: 'linear-gradient(135deg, #2a2d33 0%, #3a3d43 50%, #1e2127 100%)',
            }}
          />
        )}

        {showBadge && (
          <span
            className="absolute top-2 right-2 text-xs font-semibold px-2 py-0.5"
            style={{
              background: '#7C3AED',
              color: '#ffffff',
              borderRadius: '999px',
            }}
          >
            스토리 {recentStories.length}개
          </span>
        )}
      </div>

      <div className="pt-2 pb-1 px-0.5">
        <p className="font-semibold text-sm truncate" style={{ color: '#ffffff' }}>
          {spot.name}
        </p>
        <p className="text-xs mt-0.5 truncate" style={{ color: '#888888' }}>
          {getRegionLabel(spot.region)} · {getCategoryLabel(spot.category)}
        </p>
      </div>
    </Link>
  );
}

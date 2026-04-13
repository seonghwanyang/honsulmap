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
    <Link href={`/spot/${spot.slug}`} className="block" style={{ borderRadius: '12px', overflow: 'hidden' }}>
      <div
        className="relative"
        style={{ aspectRatio: '4/3', background: '#f3f4f6', borderRadius: '12px', overflow: 'hidden' }}
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
            className="w-full h-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 50%, #f9fafb 100%)',
            }}
          >
            <span style={{ fontSize: '28px', opacity: 0.4 }}>🍺</span>
          </div>
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
            스토리 {recentStories.length}
          </span>
        )}
      </div>

      <div className="pt-2 pb-1 px-0.5">
        <p className="font-semibold text-sm truncate" style={{ color: '#111827' }}>
          {spot.name}
        </p>
        <p className="text-xs mt-0.5 truncate" style={{ color: '#6b7280' }}>
          {getRegionLabel(spot.region)} · {getCategoryLabel(spot.category)}
        </p>
      </div>
    </Link>
  );
}

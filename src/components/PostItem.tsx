import Link from 'next/link';
import { Post } from '@/lib/types';
import { getCategoryLabel, relativeTime } from '@/lib/utils';

interface PostItemProps {
  post: Post;
}

const CATEGORY_COLORS: Record<string, string> = {
  status: '#2563EB',
  review: '#0891B2',
  tip: '#059669',
  free: '#6B7280',
};

export default function PostItem({ post }: PostItemProps) {
  const hasImage = post.image_urls && post.image_urls.length > 0;
  const categoryColor = CATEGORY_COLORS[post.category] || '#2563EB';

  return (
    <Link
      href={`/post/${post.id}`}
      className="flex items-start gap-3 px-4 py-3 border-b"
      style={{ borderColor: '#F0F0F0', background: '#ffffff' }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded flex-shrink-0"
            style={{
              background: categoryColor,
              color: '#ffffff',
              borderRadius: '4px',
            }}
          >
            {getCategoryLabel(post.category)}
          </span>
          {hasImage && (
            <span className="text-xs flex-shrink-0" style={{ color: '#888888' }}>
              🖼
            </span>
          )}
        </div>

        <p className="text-sm font-medium truncate" style={{ color: '#16191E' }}>
          {post.title}
        </p>

        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs" style={{ color: '#888888' }}>
            {post.nickname}
          </span>
          <span className="text-xs" style={{ color: '#cccccc' }}>
            ·
          </span>
          <span className="text-xs" style={{ color: '#888888' }}>
            {relativeTime(post.created_at)}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0 pt-1">
        <span className="text-xs" style={{ color: '#888888' }}>
          ♡ {post.like_count}
        </span>
        <span className="text-xs" style={{ color: '#888888' }}>
          💬 {post.comment_count}
        </span>
      </div>
    </Link>
  );
}

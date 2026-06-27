'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import ReportModal from '@/components/ReportModal';
import InlineAd from '@/components/ads/InlineAd';
import { INLINE_AD_UNITS } from '@/lib/ads/config';
import { Spot, SpotWithStories, Story } from '@/lib/types';
import { relativeTime, getCategoryLabel, getRegionLabel } from '@/lib/utils';
import { track, shouldFireOnceForStory, type EntrySource } from '@/lib/analytics';
import { useStoryImpression } from '@/lib/hooks/useStoryImpression';
import { usePageDwell } from '@/lib/hooks/usePageDwell';
import { useScrollDepth } from '@/lib/hooks/useScrollDepth';
import { useUser } from '@/lib/useUser';
import LoginModal from '@/components/LoginModal';
import FavoriteButton from '@/components/FavoriteButton';

function BackButton() {
  return (
    <button
      onClick={() => window.history.back()}
      className="flex items-center gap-1 text-sm"
      style={{ color: '#6b7280' }}
      aria-label="뒤로가기"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
      뒤로
    </button>
  );
}

function LikeButton({ targetType, targetId, initialCount }: { targetType: string; targetId: string; initialCount: number }) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);

  const handleLike = async () => {
    try {
      const endpoint = targetType === 'spot'
        ? `/api/spots/${targetId}/like`
        : `/api/comments/${targetId}/like`;
      const { getFingerprint } = await import('@/lib/utils');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint: getFingerprint() }),
      });
      if (res.ok) {
        setLiked((v) => !v);
        setCount((c) => (liked ? c - 1 : c + 1));
        if (targetType === 'spot' && !liked) track('like', { spot_id: targetId });
      }

    } catch (err) {
      console.error('Like error:', err);
    }
  };

  return (
    <button
      onClick={handleLike}
      className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium"
      style={{
        background: liked ? '#111827' : '#f8f9fa',
        borderRadius: '10px',
        color: liked ? '#ffffff' : '#6b7280',
        border: liked ? '1.5px solid #111827' : '1.5px solid #e5e7eb',
        cursor: 'pointer',
      }}
    >
      <span>{liked ? '♥' : '♡'}</span>
      <span>{count}</span>
    </button>
  );
}

function CommentSection({ spotId }: { spotId: string }) {
  const [comments, setComments] = useState<Array<{ id: string; nickname: string; content: string; created_at: string; like_count: number }>>([]);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reportId, setReportId] = useState<string | null>(null);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch(`/api/comments?spot_id=${spotId}`);
        if (res.ok) setComments(await res.json());
      } catch (err) {
        console.error('Comments fetch error:', err);
      }
    };
    fetch_();
  }, [spotId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !password.trim() || !content.trim()) return;
    setError('');
    if (password.length < 4) {
      setError('비밀번호는 4자 이상이어야 합니다.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spot_id: spotId, nickname, password, content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `댓글 등록 실패 (${res.status})`);
      }
      const newComment = await res.json();
      setComments((prev) => [newComment, ...prev]);
      setContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-4 py-4">
      <p className="font-semibold text-sm mb-3" style={{ color: '#111827' }}>
        댓글 {comments.length > 0 && `(${comments.length})`}
      </p>

      <form onSubmit={handleSubmit} className="mb-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            placeholder="닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="flex-1 px-3 py-2 text-sm"
            style={{ background: '#f9fafb', color: '#111827', border: '1px solid #e5e7eb', borderRadius: '8px' }}
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1 px-3 py-2 text-sm"
            style={{ background: '#f9fafb', color: '#111827', border: '1px solid #e5e7eb', borderRadius: '8px' }}
          />
        </div>
        <textarea
          placeholder="댓글을 남겨주세요"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm resize-none"
          style={{ background: '#f9fafb', color: '#111827', border: '1px solid #e5e7eb', borderRadius: '8px' }}
        />
        <p className="text-xs" style={{ color: '#9ca3af' }}>
          비밀번호는 4자 이상 · 댓글 수정·삭제할 때 쓰여요
        </p>
        {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
        <button
          type="submit"
          disabled={submitting || !nickname.trim() || !password.trim() || !content.trim()}
          className="self-end px-4 py-2 text-sm font-medium"
          style={{
            background: '#111827',
            color: '#ffffff',
            borderRadius: '8px',
            opacity: submitting || !nickname.trim() || !password.trim() || !content.trim() ? 0.4 : 1,
          }}
        >
          {submitting ? '등록 중...' : '등록'}
        </button>
      </form>

      <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
        {comments.map((c) => (
          <div key={c.id} className="py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold" style={{ color: '#111827' }}>
                {c.nickname}
              </span>
              <span className="text-xs" style={{ color: '#d1d5db' }}>
                {relativeTime(c.created_at)}
              </span>
              <button
                onClick={() => setReportId(c.id)}
                className="ml-auto text-xs"
                style={{ color: '#9ca3af' }}
              >
                신고
              </button>
            </div>
            <p className="text-sm" style={{ color: '#374151', whiteSpace: 'pre-wrap' }}>
              {c.content}
            </p>
          </div>
        ))}
      </div>

      <ReportModal
        open={!!reportId}
        onClose={() => setReportId(null)}
        targetType="comment"
        targetId={reportId || ''}
      />
    </div>
  );
}

// Single story card on the dedicated /spot/[slug] page. Mirrors the
// map-sheet variant but emits surface='spot_page' on each event.
function SpotPageStory({
  story,
  spot,
}: {
  story: Story;
  spot: SpotWithStories;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useStoryImpression(ref, {
    story_id: story.id,
    spot_id: spot.id,
    region: spot.region,
    category: spot.category,
    surface: 'spot_page',
  });

  const onPlay = () => {
    if (shouldFireOnceForStory('story_play', story.id)) {
      track('story_play', { story_id: story.id, spot_id: spot.id, surface: 'spot_page' });
    }
  };
  const onTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (v.duration && v.currentTime / v.duration >= 0.75) {
      if (shouldFireOnceForStory('story_progress_75', story.id)) {
        track('story_progress_75', { story_id: story.id, spot_id: spot.id, surface: 'spot_page' });
      }
    }
  };
  const onEnded = () => {
    if (shouldFireOnceForStory('story_complete', story.id)) {
      track('story_complete', { story_id: story.id, spot_id: spot.id, surface: 'spot_page' });
    }
  };

  return (
    <div
      ref={ref}
      className="relative w-full"
      style={{ aspectRatio: '9/16', borderRadius: '14px', overflow: 'hidden', background: '#000' }}
    >
      {story.media_type === 'video' ? (
        <video
          src={story.media_url}
          poster={story.thumbnail_url || undefined}
          className="w-full h-full object-cover"
          controls
          playsInline
          muted
          onPlay={onPlay}
          onTimeUpdate={onTimeUpdate}
          onEnded={onEnded}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={story.thumbnail_url || story.media_url}
          alt={`스토리 ${relativeTime(story.posted_at)}`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      )}
      {/* Top gradient overlay with avatar + name + time */}
      <div
        className="absolute top-0 left-0 right-0 px-3 py-2 flex items-center gap-2"
        style={{ background: 'linear-gradient(rgba(0,0,0,0.5), transparent)' }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2h8l-2 10h-4L8 2z" /><path d="M12 12v6" /><path d="M9 18h6" />
          </svg>
        </div>
        <span className="text-xs font-semibold" style={{ color: '#fff' }}>
          {spot.name}
        </span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {relativeTime(story.posted_at)}
        </span>
      </div>
    </div>
  );
}

// ---- Main Page ----

export default function SpotPage({ initialSpot = null }: { initialSpot?: Spot | null }) {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;

  // Seed from the server-fetched base row so the spot's info (name, region,
  // address, hours, menus, summary paragraph) renders during SSR instead of a
  // spinner. Stories load client-side and replace this seed. Near-empty SSR
  // HTML was making Google cluster spot pages as dups (GSC "중복, 표준 없음").
  const [spot, setSpot] = useState<SpotWithStories | null>(
    initialSpot ? { ...initialSpot, stories: [], latest_story_at: null } : null,
  );
  const [loading, setLoading] = useState(!initialSpot);
  const [error, setError] = useState<string | null>(null);
  // Total story count returned by the API; the initial response only
  // includes the most-recent 5, so this drives the "이전 스토리 더 보기"
  // button visibility.
  const [storyTotal, setStoryTotal] = useState<number>(0);
  const [loadingMoreStories, setLoadingMoreStories] = useState(false);

  usePageDwell('spot', slug);
  useScrollDepth('spot', slug);
  const { user } = useUser();
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    const fetchSpot = async () => {
      setError(null);
      try {
        const res = await fetch(`/api/spots/${slug}`);
        if (!res.ok) throw new Error(`가게 정보를 불러오지 못했습니다 (${res.status})`);
        const data: SpotWithStories & { story_total?: number } = await res.json();
        setSpot(data);
        setStoryTotal(data.story_total ?? data.stories?.length ?? 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetchSpot();
  }, [slug]);

  const loadMoreStories = async () => {
    if (!spot || loadingMoreStories) return;
    setLoadingMoreStories(true);
    try {
      const offset = spot.stories.length;
      const res = await fetch(`/api/spots/${slug}/stories?offset=${offset}&limit=5`);
      if (!res.ok) return;
      const json = (await res.json()) as { stories: Story[]; total: number };
      setSpot((cur) =>
        cur ? { ...cur, stories: [...cur.stories, ...(json.stories ?? [])] } : cur,
      );
      setStoryTotal(json.total ?? offset + (json.stories?.length ?? 0));
    } finally {
      setLoadingMoreStories(false);
    }
  };

  // Fire spot_detail_entered once we have the spot id and the resolved
  // entry_source from ?from=. Defaults to 'direct' for raw URL hits.
  useEffect(() => {
    if (!spot) return;
    const from = searchParams.get('from');
    const allowed: EntrySource[] = ['map', 'feed', 'search', 'community', 'direct'];
    const entry_source: EntrySource = (allowed as string[]).includes(from || '')
      ? (from as EntrySource)
      : 'direct';
    track('spot_detail_entered', { spot_id: spot.id, entry_source });
    // Bump the spot's view counter (fire-and-forget; same endpoint the
    // map sheet hits when it opens). Each /spot/[slug] mount counts.
    fetch(`/api/spots/${spot.slug}/view`, { method: 'POST' }).catch(() => {});
    // Only fire once per spot load — not on every searchParams tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spot?.id]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: '100dvh', background: '#ffffff' }}
      >
        <span className="text-sm" style={{ color: '#9ca3af' }}>불러오는 중...</span>
      </div>
    );
  }

  if (error || !spot) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3"
        style={{ height: '100dvh', background: '#ffffff' }}
      >
        <span className="text-sm" style={{ color: '#ef4444' }}>
          {error || '가게를 찾을 수 없습니다'}
        </span>
        <button
          onClick={() => window.history.back()}
          className="text-xs px-3 py-1.5"
          style={{ background: '#f3f4f6', color: '#374151', borderRadius: '6px' }}
        >
          뒤로 가기
        </button>
      </div>
    );
  }

  const activeStories = [...spot.stories].sort(
    (a: Story, b: Story) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime(),
  );

  const naverMapUrl = spot.naver_place_id
    ? `https://map.naver.com/v5/entry/place/${spot.naver_place_id}`
    : `https://map.naver.com/v5/search/${encodeURIComponent(spot.name)}`;

  const instagramUrl = spot.instagram_id
    ? `https://www.instagram.com/${spot.instagram_id}/`
    : null;

  return (
    <div style={{ background: '#ffffff', minHeight: '100dvh' }}>
      {/* Sticky nav bar — back button only */}
      <header
        className="sticky top-0 z-20 flex items-center gap-3 px-4"
        style={{
          height: '52px',
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <BackButton />
        <span className="font-semibold text-sm truncate flex-1" style={{ color: '#111827' }}>
          {spot.name}
        </span>
      </header>

      {/* Spot info block — mirrors the map sheet header exactly */}
      <div className="px-4 pt-2 pb-3" style={{ borderBottom: '1px solid #f3f4f6' }}>
        <h2 className="font-bold text-base truncate" style={{ color: '#111827' }}>
          {spot.name}
        </h2>
        <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
          {getRegionLabel(spot.region)} · {getCategoryLabel(spot.category)}
          {storyTotal > 0 && ` · 스토리 ${storyTotal}개`}
        </p>

        {/* Action chips — 상세보기 dropped (we are the detail page) */}
        <div className="flex gap-2 mt-3">
          {instagramUrl && (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                track('instagram_link_clicked', {
                  spot_id: spot.id,
                  region: spot.region,
                  category: spot.category,
                  surface: 'spot_page_action',
                });
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
              style={{ background: '#f3f4f6', color: '#374151', borderRadius: '8px', textDecoration: 'none' }}
            >
              인스타
            </a>
          )}
          <a
            href={naverMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium"
            style={{ background: '#f3f4f6', color: '#16a34a', borderRadius: '8px', textDecoration: 'none' }}
          >
            네이버지도
          </a>
        </div>

        {/* Compact info bar — conditional, mirrors sheet exactly */}
        {(spot.business_hours || spot.naver_rating != null || spot.phone) && (
          <div
            className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2.5 text-[11px]"
            style={{ color: '#6b7280' }}
          >
            {spot.business_hours && (
              <span className="inline-flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <span style={{ color: '#374151' }}>{spot.business_hours}</span>
              </span>
            )}
            {spot.naver_rating != null && (
              <span className="inline-flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="0"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <span style={{ color: '#374151' }}>
                  {spot.naver_rating.toFixed(2)}
                  {spot.naver_review_count != null && (
                    <span style={{ color: '#9ca3af' }}> ({spot.naver_review_count.toLocaleString()})</span>
                  )}
                </span>
              </span>
            )}
            {spot.phone && (
              <a
                href={`tel:${spot.phone.replace(/[^0-9+]/g, '')}`}
                className="inline-flex items-center gap-1"
                style={{ color: '#374151', textDecoration: 'none' }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                {spot.phone}
              </a>
            )}
          </div>
        )}

        {/* Admin memo — matches MapClient panel placement so both
            surfaces present the same spot info hierarchy. */}
        {spot.memo && (
          <p
            className="mt-2 text-[12px] leading-snug"
            style={{ color: '#4b5563' }}
          >
            {spot.memo}
          </p>
        )}

        {spot.benefit_active && spot.benefit_title && (!spot.benefit_expires_at || new Date(spot.benefit_expires_at) > new Date()) && (
          <div
            className="mt-3 flex items-center gap-3"
            style={{
              background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
              border: '1px solid #fed7aa',
              borderRadius: 14,
              padding: '12px 14px',
              boxShadow: '0 2px 8px rgba(234, 88, 12, 0.10)',
            }}
          >
            <div
              className="flex-shrink-0 flex items-center justify-center"
              style={{ width: 42, height: 42, background: '#111827', borderRadius: 12 }}
              aria-hidden="true"
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 12 20 22 4 22 4 12" />
                <rect x="2" y="7" width="20" height="5" />
                <line x1="12" y1="22" x2="12" y2="7" />
                <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
              </svg>
            </div>
            <div className="min-w-0">
              <span style={{ display: 'block', fontSize: 11, fontWeight: 800, letterSpacing: 0.4, color: '#ea580c', lineHeight: 1, marginBottom: 3 }}>오늘의 혜택</span>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#111827', lineHeight: 1.35 }}>{spot.benefit_title}</span>
              {spot.benefit_detail && (
                <span style={{ display: 'block', fontSize: 12, color: '#c2410c', marginTop: 3, lineHeight: 1.5 }}>
                  {spot.benefit_detail}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Like + Favorite */}
      <div className="px-4 mt-4 flex gap-2">
        <LikeButton targetType="spot" targetId={spot.slug} initialCount={spot.like_count} />
        <FavoriteButton spotId={spot.id} onNeedLogin={() => setLoginOpen(true)} />
      </div>

      {/* Stories — 1-column full-width 9:16 cards, NativeCard after each except last */}
      <div className="flex flex-col gap-3 px-4 py-3 mt-2">
        {activeStories.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <span style={{ fontSize: '40px', opacity: 0.3 }}>📷</span>
            <p className="text-sm" style={{ color: '#9ca3af' }}>현재 활성 스토리가 없습니다</p>
            {instagramUrl && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  track('instagram_link_clicked', {
                    spot_id: spot.id,
                    region: spot.region,
                    category: spot.category,
                    surface: 'spot_page_empty',
                  });
                }}
                className="text-xs px-3 py-1.5 font-medium"
                style={{ background: '#111827', color: '#fff', borderRadius: '6px', textDecoration: 'none' }}
              >
                인스타에서 확인
              </a>
            )}
          </div>
        ) : !user ? (
          // Guest: FIRST story is free (a taste), the rest behind a login gate.
          // One free story converts far better than walling everything, and is a
          // better first impression for visitors / the AdSense reviewer.
          <div className="flex flex-col gap-3">
            {activeStories[0] && (
              <SpotPageStory key={activeStories[0].id} story={activeStories[0]} spot={spot} />
            )}
            {storyTotal > 1 && (
              <div className="relative" style={{ minHeight: 220 }}>
                <div
                  className="flex flex-col gap-3"
                  style={{ filter: 'blur(10px)', pointerEvents: 'none', userSelect: 'none' }}
                  aria-hidden="true"
                >
                  {(activeStories.length > 1
                    ? activeStories.slice(1, 3)
                    : activeStories.slice(0, 1)
                  ).map((story: Story) => (
                    <SpotPageStory key={`blur-${story.id}`} story={story} spot={spot} />
                  ))}
                </div>
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-6 text-center"
                  style={{ background: 'linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0.7))' }}
                >
                  <button
                    onClick={() => {
                      setLoginOpen(true);
                      track('story_login_blocked', { spot_id: slug, surface: 'spot_page' });
                    }}
                    className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold"
                    style={{ background: '#111827', color: '#fff', borderRadius: '10px', cursor: 'pointer' }}
                  >
                    🔒 로그인하고 나머지 스토리 보기
                  </button>
                  <span className="text-xs" style={{ color: '#4b5563' }}>
                    로그인하면 {spot.name}의 스토리 {storyTotal}개를 모두 볼 수 있어요
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {(() => {
              const items: React.ReactNode[] = [];
              let adCount = 0;
              activeStories.forEach((story: Story, idx: number) => {
                items.push(
                  <SpotPageStory key={story.id} story={story} spot={spot} />,
                );
                // Up to INLINE_AD_UNITS.length inline ads, each a distinct unit
                // (AdFit renders a unit only once per page). Skip the last story
                // so an ad never sits next to the "더 보기" button — and since
                // ads stop after the first few slots, stories loaded via
                // "더 보기" get none.
                if (idx < activeStories.length - 1 && adCount < INLINE_AD_UNITS.length) {
                  items.push(
                    <InlineAd key={`ad-${idx}`} unit={INLINE_AD_UNITS[adCount]} />,
                  );
                  adCount++;
                }
              });
              return items;
            })()}
            {activeStories.length < storyTotal && (
              <button
                onClick={loadMoreStories}
                disabled={loadingMoreStories}
                className="w-full py-3 mt-2 text-sm font-medium"
                style={{
                  background: '#f3f4f6',
                  color: loadingMoreStories ? '#9ca3af' : '#374151',
                  borderRadius: '10px',
                  border: 'none',
                  cursor: loadingMoreStories ? 'default' : 'pointer',
                  letterSpacing: '-0.1px',
                }}
              >
                {loadingMoreStories
                  ? '불러오는 중…'
                  : `이전 스토리 더 보기 (${storyTotal - activeStories.length})`}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Naver Place Photos — horizontal carousel */}
      {spot.naver_photos && spot.naver_photos.length > 0 && (
        <div className="mt-6 px-4">
          <p className="font-semibold text-sm mb-3" style={{ color: '#111827' }}>
            가게 사진 <span style={{ color: '#9ca3af', fontWeight: 400 }}>({spot.naver_photos.length})</span>
          </p>
          <div
            className="flex gap-2 overflow-x-auto hide-scrollbar"
            style={{ paddingBottom: 4 }}
          >
            {spot.naver_photos.map((url: string, i: number) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="relative flex-shrink-0"
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: 10,
                  overflow: 'hidden',
                  background: '#f3f4f6',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${spot.name} 사진 ${i + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Naver Place Menus — list */}
      {spot.naver_menus && spot.naver_menus.length > 0 && (
        <div className="mt-6 px-4">
          <p className="font-semibold text-sm mb-3" style={{ color: '#111827' }}>
            메뉴 <span style={{ color: '#9ca3af', fontWeight: 400 }}>({spot.naver_menus.length})</span>
          </p>
          <div
            className="flex flex-col"
            style={{ background: '#f8f9fa', borderRadius: 12, overflow: 'hidden' }}
          >
            {spot.naver_menus.map((menu, i: number) => (
              <div
                key={i}
                className="flex items-center gap-3 px-3 py-2.5"
                style={{
                  borderBottom: i < spot.naver_menus!.length - 1 ? '1px solid #f3f4f6' : 'none',
                }}
              >
                {menu.image && (
                  <div
                    className="flex-shrink-0"
                    style={{
                      width: 56,
                      height: 56,
                      borderRadius: 8,
                      overflow: 'hidden',
                      background: '#fff',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={menu.image}
                      alt={menu.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: '#111827' }}
                  >
                    {menu.name}
                  </p>
                  {menu.description && (
                    <p
                      className="text-xs mt-0.5 truncate"
                      style={{ color: '#9ca3af' }}
                    >
                      {menu.description}
                    </p>
                  )}
                </div>
                {menu.price && (
                  <span
                    className="text-xs font-semibold flex-shrink-0"
                    style={{ color: '#374151' }}
                  >
                    {Number.isFinite(Number(menu.price))
                      ? `${Number(menu.price).toLocaleString()}원`
                      : menu.price}
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] mt-1.5" style={{ color: '#9ca3af' }}>
            * 메뉴·가격은 네이버 플레이스 기준이며 가게 사정에 따라 다를 수 있습니다.
          </p>
        </div>
      )}

      {/* Auto-generated paragraph from Naver Place data. Adds 80-100
          words to the page text crawlers see, so AdSense doesn't read
          spot pages as "thin content." Only renders when we have at
          least one fact to state. */}
      {(spot.naver_rating != null || spot.business_hours || (spot.naver_menus && spot.naver_menus.length > 0) || spot.phone) && (
        <section
          aria-label="가게 요약"
          className="px-4 mt-6 text-[13px] leading-relaxed"
          style={{ color: '#374151' }}
        >
          <h2 className="font-bold text-[14px] mb-2" style={{ color: '#111827' }}>
            {spot.name} 정보 요약
          </h2>
          <p>
            <strong>{spot.name}</strong>은(는) {getRegionLabel(spot.region)}에 위치한{' '}
            {getCategoryLabel(spot.category)}입니다.
            {spot.naver_rating != null && (
              <>
                {' '}네이버 별점은{' '}
                <strong>{spot.naver_rating.toFixed(2)}점</strong>
                {spot.naver_review_count != null && (
                  <> ({spot.naver_review_count.toLocaleString()}개 리뷰)</>
                )}
                이며,
              </>
            )}
            {spot.business_hours && (
              <> 영업시간은 <strong>{spot.business_hours}</strong>입니다.</>
            )}
            {spot.naver_menus && spot.naver_menus.length > 0 && (
              <>
                {' '}대표 메뉴는{' '}
                {spot.naver_menus
                  .slice(0, 3)
                  .map((m) => m.name)
                  .join(', ')}
                {spot.naver_menus.length > 3 ? ' 등' : ''}이 있습니다.
              </>
            )}
            {spot.phone && (
              <> 예약·문의 전화 <strong>{spot.phone}</strong>.</>
            )}
            {' '}혼자 방문하기 좋은 카운터 자리가 마련되어 있어 처음 방문하는 분들도 부담 없이 즐길 수 있습니다.
          </p>
          {spot.address && (
            <p className="mt-2 text-[12px]" style={{ color: '#6b7280' }}>
              주소: {spot.address}
            </p>
          )}
        </section>
      )}

      {/* Category-specific vibe footer. Static prose by category — adds
          word count for SEO and helps first-time visitors understand the
          space before booking. Tone: social/사교 (per Jeju 혼술바 culture
          research), no detail-laden etiquette rules. */}
      <section
        aria-label="공간 안내"
        className="px-4 mt-5 mb-1 text-[13px] leading-relaxed"
        style={{ color: '#4b5563' }}
      >
        {spot.category === 'guesthouse' ? (
          <p>
            게스트하우스는 여행자들이 모이는 공간입니다. 파티가 있는 곳은
            DJ·라이브·게임 같은 프로그램이 있고, 조용한 곳은 거실에서 작은
            모임이 자연스럽게 만들어집니다. 어느 쪽이든 함께 머무는 다른
            게스트들에게 가벼운 인사로 시작하면 좋습니다.
          </p>
        ) : (
          <p>
            혼술바는 옆자리와 자연스럽게 대화가 이어지는 공간입니다. 사장님이
            손님 분위기를 보고 자리를 안내해주고, 술 한 잔과 함께 짧은 대화가
            시작됩니다. 가볍게 한 잔, 또는 사장님 추천을 따라 마셔보세요.
          </p>
        )}
      </section>

      {/* Comment Section */}
      <div style={{ borderTop: '1px solid #f3f4f6', marginTop: '16px' }}>
        <CommentSection spotId={spot.id} />
      </div>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  );
}

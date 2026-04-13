'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import AdBannerInline from '@/components/AdBannerInline';
import { SpotWithStories, Story } from '@/lib/types';
import { relativeTime, getCategoryLabel, getRegionLabel } from '@/lib/utils';

// ---- Inline sub-components (placeholders for components not yet created) ----

function BackButton() {
  return (
    <button
      onClick={() => window.history.back()}
      className="flex items-center gap-1 text-sm"
      style={{ color: '#aaaaaa' }}
      aria-label="뒤로가기"
    >
      ← 뒤로
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
      }
    } catch (err) {
      console.error('Like error:', err);
    }
  };

  return (
    <button
      onClick={handleLike}
      className="flex flex-col items-center gap-1 px-3 py-2"
      style={{
        background: liked ? '#7c3aed' : '#2a2d33',
        borderRadius: '8px',
        color: liked ? '#ffffff' : '#aaaaaa',
        border: 'none',
        cursor: 'pointer',
        minWidth: '56px',
      }}
    >
      <span className="text-lg">♥</span>
      <span className="text-xs">{count}</span>
    </button>
  );
}

function MoodVoteButton({ spotId, upCount, downCount }: { spotId: string; upCount: number; downCount: number }) {
  const [voted, setVoted] = useState<'up' | 'down' | null>(null);
  const [up, setUp] = useState(upCount);
  const [down, setDown] = useState(downCount);

  const handleVote = async (vote: 'up' | 'down') => {
    try {
      const { getFingerprint } = await import('@/lib/utils');
      const res = await fetch(`/api/spots/${spotId}/mood`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote, fingerprint: getFingerprint() }),
      });
      if (res.ok) {
        if (voted === vote) {
          setVoted(null);
          vote === 'up' ? setUp((v) => v - 1) : setDown((v) => v - 1);
        } else {
          if (voted === 'up') setUp((v) => v - 1);
          if (voted === 'down') setDown((v) => v - 1);
          setVoted(vote);
          vote === 'up' ? setUp((v) => v + 1) : setDown((v) => v + 1);
        }
      }
    } catch (err) {
      console.error('MoodVote error:', err);
    }
  };

  return (
    <button
      onClick={() => handleVote('up')}
      className="flex flex-col items-center gap-1 px-3 py-2"
      style={{
        background: voted === 'up' ? '#14532d' : '#2a2d33',
        borderRadius: '8px',
        color: voted === 'up' ? '#4ade80' : '#aaaaaa',
        border: 'none',
        cursor: 'pointer',
        minWidth: '56px',
      }}
      aria-label="분위기 좋아요"
    >
      <span className="text-lg">⬆</span>
      <span className="text-xs">{up}</span>
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
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spot_id: spotId, nickname, password, content }),
      });
      if (!res.ok) throw new Error('댓글 등록 실패');
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
      <p className="font-semibold text-sm mb-3" style={{ color: '#ffffff' }}>
        댓글 {comments.length > 0 && `(${comments.length})`}
      </p>

      <form onSubmit={handleSubmit} className="mb-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            placeholder="닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="flex-1 px-3 py-2 text-sm"
            style={{ background: '#2a2d33', color: '#ffffff', border: '1px solid #3a3d43', borderRadius: '6px' }}
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1 px-3 py-2 text-sm"
            style={{ background: '#2a2d33', color: '#ffffff', border: '1px solid #3a3d43', borderRadius: '6px' }}
          />
        </div>
        <textarea
          placeholder="댓글을 남겨주세요"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm resize-none"
          style={{ background: '#2a2d33', color: '#ffffff', border: '1px solid #3a3d43', borderRadius: '6px' }}
        />
        {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
        <button
          type="submit"
          disabled={submitting || !nickname.trim() || !password.trim() || !content.trim()}
          className="self-end px-4 py-2 text-sm font-medium"
          style={{
            background: '#F59E0B',
            color: '#111111',
            borderRadius: '6px',
            opacity: submitting || !nickname.trim() || !password.trim() || !content.trim() ? 0.5 : 1,
          }}
        >
          {submitting ? '등록 중...' : '등록'}
        </button>
      </form>

      <div className="divide-y" style={{ borderColor: '#2a2d33' }}>
        {comments.map((c) => (
          <div key={c.id} className="py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium" style={{ color: '#F59E0B' }}>
                {c.nickname}
              </span>
              <span className="text-xs" style={{ color: '#555555' }}>
                {relativeTime(c.created_at)}
              </span>
            </div>
            <p className="text-sm" style={{ color: '#cccccc', whiteSpace: 'pre-wrap' }}>
              {c.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Main Page ----

export default function SpotPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [spot, setSpot] = useState<SpotWithStories | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSpot = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/spots/${slug}`);
        if (!res.ok) throw new Error(`가게 정보를 불러오지 못했습니다 (${res.status})`);
        const data: SpotWithStories = await res.json();
        setSpot(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetchSpot();
  }, [slug]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: '100dvh', background: '#16191E' }}
      >
        <span className="text-sm" style={{ color: '#888888' }}>불러오는 중...</span>
      </div>
    );
  }

  if (error || !spot) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3"
        style={{ height: '100dvh', background: '#16191E' }}
      >
        <span className="text-sm" style={{ color: '#ef4444' }}>
          {error || '가게를 찾을 수 없습니다'}
        </span>
        <button
          onClick={() => window.history.back()}
          className="text-xs px-3 py-1.5"
          style={{ background: '#2a2d33', color: '#ffffff', borderRadius: '6px' }}
        >
          뒤로 가기
        </button>
      </div>
    );
  }

  const now = Date.now();
  const activeStories = spot.stories
    .filter((s: Story) => new Date(s.expires_at).getTime() > now)
    .sort((a: Story, b: Story) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());

  const naverMapUrl = spot.naver_place_id
    ? `https://map.naver.com/v5/entry/place/${spot.naver_place_id}`
    : `https://map.naver.com/v5/search/${encodeURIComponent(spot.name)}`;

  const instagramUrl = spot.instagram_id
    ? `https://www.instagram.com/${spot.instagram_id}/`
    : null;

  return (
    <div style={{ background: '#16191E', minHeight: '100dvh', paddingBottom: '72px' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-20 flex items-center gap-3 px-4"
        style={{ height: '52px', background: '#16191E', borderBottom: '1px solid #2a2d33' }}
      >
        <BackButton />
        <span className="font-semibold text-sm truncate flex-1" style={{ color: '#ffffff' }}>
          {spot.name}
        </span>
      </header>

      {/* Photo Strip */}
      {spot.image_urls && spot.image_urls.length > 0 ? (
        <div
          className="flex gap-2 overflow-x-auto px-4 py-3"
          style={{ scrollbarWidth: 'none' }}
        >
          {spot.image_urls.map((url, idx) => (
            <div
              key={idx}
              className="relative flex-shrink-0"
              style={{ width: '160px', height: '120px', borderRadius: '8px', overflow: 'hidden', background: '#2a2d33' }}
            >
              <Image
                src={url}
                alt={`${spot.name} 사진 ${idx + 1}`}
                fill
                className="object-cover"
                sizes="160px"
              />
            </div>
          ))}
        </div>
      ) : (
        <div
          className="mx-4 mt-3 flex items-center justify-center"
          style={{ height: '120px', background: '#2a2d33', borderRadius: '8px', color: '#555555', fontSize: '12px' }}
        >
          등록된 사진이 없습니다
        </div>
      )}

      {/* Meta Info Grid */}
      <div
        className="mx-4 mt-3 grid grid-cols-2 gap-2"
      >
        <div
          className="p-3"
          style={{ background: '#2a2d33', borderRadius: '8px' }}
        >
          <p className="text-xs mb-1" style={{ color: '#888888' }}>영업시간</p>
          <p className="text-xs font-medium" style={{ color: '#ffffff' }}>
            {spot.business_hours || '정보 없음'}
          </p>
        </div>
        <div
          className="p-3"
          style={{ background: '#2a2d33', borderRadius: '8px' }}
        >
          <p className="text-xs mb-1" style={{ color: '#888888' }}>최근 스토리</p>
          <p className="text-xs font-medium" style={{ color: '#ffffff' }}>
            {spot.latest_story_at ? relativeTime(spot.latest_story_at) : '없음'}
          </p>
        </div>
        <div
          className="p-3"
          style={{ background: '#2a2d33', borderRadius: '8px' }}
        >
          <p className="text-xs mb-1" style={{ color: '#888888' }}>지역</p>
          <p className="text-xs font-medium" style={{ color: '#ffffff' }}>
            {getRegionLabel(spot.region)}
          </p>
        </div>
        <div
          className="p-3"
          style={{ background: '#2a2d33', borderRadius: '8px' }}
        >
          <p className="text-xs mb-1" style={{ color: '#888888' }}>카테고리</p>
          <p className="text-xs font-medium" style={{ color: '#ffffff' }}>
            {getCategoryLabel(spot.category)}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 px-4 mt-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <LikeButton targetType="spot" targetId={spot.slug} initialCount={spot.like_count} />
        <MoodVoteButton spotId={spot.slug} upCount={spot.mood_up} downCount={spot.mood_down} />
        <a
          href={naverMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center gap-1 px-3 py-2"
          style={{ background: '#2a2d33', borderRadius: '8px', color: '#4ade80', minWidth: '56px', textDecoration: 'none' }}
        >
          <span className="text-lg">🗺</span>
          <span className="text-xs">지도</span>
        </a>
        {instagramUrl && (
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 px-3 py-2"
            style={{ background: '#2a2d33', borderRadius: '8px', color: '#e879f9', minWidth: '56px', textDecoration: 'none' }}
          >
            <span className="text-lg">📷</span>
            <span className="text-xs">인스타</span>
          </a>
        )}
      </div>

      {/* Instagram Stories Section */}
      <div className="mt-6 px-4">
        <p className="font-semibold text-sm mb-3" style={{ color: '#ffffff' }}>
          인스타 스토리
        </p>

        {activeStories.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-3 py-8"
            style={{ background: '#2a2d33', borderRadius: '12px' }}
          >
            <p className="text-sm" style={{ color: '#888888' }}>
              아직 스토리가 없습니다
            </p>
            {instagramUrl && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1.5"
                style={{ background: '#F59E0B', color: '#111111', borderRadius: '6px', textDecoration: 'none' }}
              >
                인스타 바로가기
              </a>
            )}
          </div>
        ) : (
          <div
            className="flex gap-3 overflow-y-auto"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
              gap: '12px',
            }}
          >
            {activeStories.map((story: Story) => (
              <div
                key={story.id}
                className="relative"
                style={{
                  aspectRatio: '9/16',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  background: '#2a2d33',
                }}
              >
                {story.media_type === 'video' ? (
                  <video
                    src={story.media_url}
                    poster={story.thumbnail_url || undefined}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />
                ) : (
                  <Image
                    src={story.thumbnail_url || story.media_url}
                    alt={`스토리 ${relativeTime(story.posted_at)}`}
                    fill
                    className="object-cover"
                    sizes="120px"
                  />
                )}
                <div
                  className="absolute bottom-0 left-0 right-0 px-2 py-1"
                  style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}
                >
                  <p className="text-xs" style={{ color: '#ffffff' }}>
                    {relativeTime(story.posted_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ad Banner */}
      <div className="flex justify-center mt-6">
        <AdBannerInline size="320x100" />
      </div>

      {/* Comment Section */}
      <div style={{ borderTop: '1px solid #2a2d33', marginTop: '16px' }}>
        <CommentSection spotId={spot.id} />
      </div>
    </div>
  );
}

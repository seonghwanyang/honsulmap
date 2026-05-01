'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import NativeHorizontal from '@/components/ads/NativeHorizontal';
import NativeCard from '@/components/ads/NativeCard';
import ReportModal from '@/components/ReportModal';
import { SpotWithStories, Story } from '@/lib/types';
import { relativeTime, getCategoryLabel, getRegionLabel } from '@/lib/utils';

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

  const total = up + down;
  const upPercent = total > 0 ? Math.round((up / total) * 100) : 50;
  const downPercent = total > 0 ? 100 - upPercent : 50;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium" style={{ color: '#6b7280' }}>분위기 투표</span>
        <span className="text-xs" style={{ color: '#9ca3af' }}>총 {total}표</span>
      </div>
      <div className="vote-bar">
        <button
          onClick={() => handleVote('up')}
          className="vote-bar-up"
          style={{
            width: `${Math.max(upPercent, 15)}%`,
            opacity: voted === 'down' ? 0.6 : 1,
            cursor: 'pointer',
            border: 'none',
          }}
        >
          &#9650; {upPercent}% ({up})
        </button>
        <button
          onClick={() => handleVote('down')}
          className="vote-bar-down"
          style={{
            width: `${Math.max(downPercent, 15)}%`,
            opacity: voted === 'up' ? 0.6 : 1,
            cursor: 'pointer',
            border: 'none',
          }}
        >
          &#9660; {downPercent}% ({down})
        </button>
      </div>
    </div>
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
      {/* Header */}
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

      {/* Photo Strip */}
      {spot.image_urls && spot.image_urls.length > 0 ? (
        <div
          className="flex gap-2 overflow-x-auto px-4 py-3 hide-scrollbar"
        >
          {spot.image_urls.map((url, idx) => (
            <div
              key={idx}
              className="relative flex-shrink-0"
              style={{ width: '160px', height: '120px', borderRadius: '10px', overflow: 'hidden', background: '#f3f4f6' }}
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
          style={{ height: '120px', background: '#f8f9fa', borderRadius: '12px', color: '#d1d5db', fontSize: '12px' }}
        >
          등록된 사진이 없습니다
        </div>
      )}

      {/* Meta Info */}
      <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
        <div className="p-3" style={{ background: '#f8f9fa', borderRadius: '10px' }}>
          <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>영업시간</p>
          <p className="text-xs font-medium" style={{ color: '#111827' }}>
            {spot.business_hours || '정보 없음'}
          </p>
        </div>
        <div className="p-3" style={{ background: '#f8f9fa', borderRadius: '10px' }}>
          <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>최근 스토리</p>
          <p className="text-xs font-medium" style={{ color: '#111827' }}>
            {spot.latest_story_at ? relativeTime(spot.latest_story_at) : '없음'}
          </p>
        </div>
        <div className="p-3" style={{ background: '#f8f9fa', borderRadius: '10px' }}>
          <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>네이버 별점</p>
          <p className="text-xs font-medium" style={{ color: '#111827' }}>
            {spot.naver_rating != null ? (
              <>
                <span style={{ color: '#f59e0b' }}>★</span> {spot.naver_rating.toFixed(2)}
                {spot.naver_review_count != null && (
                  <span style={{ color: '#9ca3af', fontWeight: 400 }}>
                    {' '}
                    ({spot.naver_review_count.toLocaleString()})
                  </span>
                )}
              </>
            ) : (
              '정보 없음'
            )}
          </p>
        </div>
        <div className="p-3" style={{ background: '#f8f9fa', borderRadius: '10px' }}>
          <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>전화</p>
          <p className="text-xs font-medium" style={{ color: '#111827' }}>
            {spot.phone ? (
              <a
                href={`tel:${spot.phone.replace(/[^0-9+]/g, '')}`}
                style={{ color: '#111827', textDecoration: 'none' }}
              >
                {spot.phone}
              </a>
            ) : (
              '정보 없음'
            )}
          </p>
        </div>
        <div className="p-3" style={{ background: '#f8f9fa', borderRadius: '10px' }}>
          <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>지역</p>
          <p className="text-xs font-medium" style={{ color: '#111827' }}>
            {getRegionLabel(spot.region)}
          </p>
        </div>
        <div className="p-3" style={{ background: '#f8f9fa', borderRadius: '10px' }}>
          <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>카테고리</p>
          <p className="text-xs font-medium" style={{ color: '#111827' }}>
            {getCategoryLabel(spot.category)}
          </p>
        </div>
      </div>

      {/* Vote Bar */}
      <div className="px-4 mt-4">
        <MoodVoteButton spotId={spot.slug} upCount={spot.mood_up} downCount={spot.mood_down} />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 px-4 mt-4 overflow-x-auto hide-scrollbar">
        <LikeButton targetType="spot" targetId={spot.slug} initialCount={spot.like_count} />
        <a
          href={naverMapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium"
          style={{ background: '#f8f9fa', borderRadius: '10px', color: '#16a34a', border: '1.5px solid #e5e7eb', textDecoration: 'none' }}
        >
          <span>&#128506;</span>
          <span>네이버 지도</span>
        </a>
        {instagramUrl && (
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium"
            style={{ background: '#f8f9fa', borderRadius: '10px', color: '#c026d3', border: '1.5px solid #e5e7eb', textDecoration: 'none' }}
          >
            <span>&#128247;</span>
            <span>인스타</span>
          </a>
        )}
      </div>

      {/* Native ad — right below the map/Instagram action buttons (ref copy4) */}
      <div className="px-4 mt-4">
        <NativeCard />
      </div>

      {/* Instagram Stories Section */}
      <div className="mt-6 px-4">
        <p className="font-semibold text-sm mb-3" style={{ color: '#111827' }}>
          인스타 스토리
        </p>

        {activeStories.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-3 py-8"
            style={{ background: '#f8f9fa', borderRadius: '12px' }}
          >
            <p className="text-sm" style={{ color: '#9ca3af' }}>
              아직 스토리가 없습니다
            </p>
            {instagramUrl && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 font-medium"
                style={{ background: '#111827', color: '#ffffff', borderRadius: '6px', textDecoration: 'none' }}
              >
                인스타 바로가기
              </a>
            )}
          </div>
        ) : (
          <div
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
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: '#f3f4f6',
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
                  className="absolute bottom-0 left-0 right-0 px-2 py-1.5"
                  style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.6))' }}
                >
                  <p className="text-xs font-medium" style={{ color: '#ffffff' }}>
                    {relativeTime(story.posted_at)}
                  </p>
                </div>
              </div>
            ))}
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

      {/* Ad Banner — horizontal native between body and comments */}
      <div className="px-4 mt-4">
        <NativeHorizontal />
      </div>

      {/* Comment Section */}
      <div style={{ borderTop: '1px solid #f3f4f6', marginTop: '16px' }}>
        <CommentSection spotId={spot.id} />
      </div>
    </div>
  );
}

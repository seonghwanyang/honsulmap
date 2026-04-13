'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import AdBannerInline from '@/components/AdBannerInline';
import { Post } from '@/lib/types';
import { relativeTime, getCategoryLabel, getFingerprint } from '@/lib/utils';

// ---- Inline sub-components ----

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

function LikeButton({
  targetType,
  targetId,
  initialCount,
}: {
  targetType: string;
  targetId: string;
  initialCount: number;
}) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);

  const handleLike = async () => {
    try {
      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_type: targetType,
          target_id: targetId,
          fingerprint: getFingerprint(),
        }),
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
      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
      style={{
        background: liked ? '#7c3aed' : '#2a2d33',
        color: liked ? '#ffffff' : '#aaaaaa',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      <span>♥</span>
      <span>{count}</span>
    </button>
  );
}

function CommentSection({ postId }: { postId: string }) {
  const [comments, setComments] = useState<
    Array<{
      id: string;
      nickname: string;
      content: string;
      created_at: string;
      like_count: number;
      parent_id: string | null;
      replies?: Array<{ id: string; nickname: string; content: string; created_at: string; like_count: number }>;
    }>
  >([]);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await fetch(`/api/comments?post_id=${postId}`);
        if (res.ok) setComments(await res.json());
      } catch (err) {
        console.error('Comments fetch error:', err);
      }
    };
    fetchComments();
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim() || !password.trim() || !content.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const body: Record<string, string> = { post_id: postId, nickname, password, content };
      if (replyTo) body.parent_id = replyTo;
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('댓글 등록 실패');
      const newComment = await res.json();
      if (replyTo) {
        setComments((prev) =>
          prev.map((c) =>
            c.id === replyTo
              ? { ...c, replies: [...(c.replies || []), newComment] }
              : c,
          ),
        );
      } else {
        setComments((prev) => [{ ...newComment, replies: [] }, ...prev]);
      }
      setContent('');
      setReplyTo(null);
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
        {replyTo && (
          <div
            className="flex items-center justify-between px-3 py-1.5 text-xs"
            style={{ background: '#2a2d33', borderRadius: '6px', color: '#aaaaaa' }}
          >
            <span>답글 작성 중</span>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              style={{ color: '#888888' }}
            >
              취소
            </button>
          </div>
        )}
        <div className="flex gap-2">
          <input
            placeholder="닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="flex-1 px-3 py-2 text-sm"
            style={{
              background: '#2a2d33',
              color: '#ffffff',
              border: '1px solid #3a3d43',
              borderRadius: '6px',
            }}
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1 px-3 py-2 text-sm"
            style={{
              background: '#2a2d33',
              color: '#ffffff',
              border: '1px solid #3a3d43',
              borderRadius: '6px',
            }}
          />
        </div>
        <textarea
          placeholder="댓글을 남겨주세요"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm resize-none"
          style={{
            background: '#2a2d33',
            color: '#ffffff',
            border: '1px solid #3a3d43',
            borderRadius: '6px',
          }}
        />
        {error && (
          <p className="text-xs" style={{ color: '#ef4444' }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={
            submitting || !nickname.trim() || !password.trim() || !content.trim()
          }
          className="self-end px-4 py-2 text-sm font-medium"
          style={{
            background: '#F59E0B',
            color: '#111111',
            borderRadius: '6px',
            opacity:
              submitting || !nickname.trim() || !password.trim() || !content.trim()
                ? 0.5
                : 1,
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
              <button
                onClick={() => setReplyTo(c.id)}
                className="ml-auto text-xs"
                style={{ color: '#888888' }}
              >
                답글
              </button>
            </div>
            <p
              className="text-sm"
              style={{ color: '#cccccc', whiteSpace: 'pre-wrap' }}
            >
              {c.content}
            </p>

            {/* Replies */}
            {c.replies && c.replies.length > 0 && (
              <div
                className="mt-2 pl-3 border-l-2"
                style={{ borderColor: '#3a3d43' }}
              >
                {c.replies.map((r) => (
                  <div key={r.id} className="py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-xs font-medium"
                        style={{ color: '#F59E0B' }}
                      >
                        {r.nickname}
                      </span>
                      <span className="text-xs" style={{ color: '#555555' }}>
                        {relativeTime(r.created_at)}
                      </span>
                    </div>
                    <p
                      className="text-sm"
                      style={{ color: '#cccccc', whiteSpace: 'pre-wrap' }}
                    >
                      {r.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Main Page ----

export default function PostPage() {
  const params = useParams();
  const id = params.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportSent, setReportSent] = useState(false);

  useEffect(() => {
    const fetchPost = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/posts/${id}`);
        if (!res.ok) throw new Error(`게시글을 불러오지 못했습니다 (${res.status})`);
        setPost(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchPost();
  }, [id]);

  const handleShare = async () => {
    try {
      await navigator.share({ title: post?.title, url: window.location.href });
    } catch {
      await navigator.clipboard.writeText(window.location.href);
      alert('링크가 복사되었습니다');
    }
  };

  const handleReport = () => {
    if (reportSent) return;
    setReportSent(true);
    alert('신고가 접수되었습니다');
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: '100dvh', background: '#16191E' }}
      >
        <span className="text-sm" style={{ color: '#888888' }}>
          불러오는 중...
        </span>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3"
        style={{ height: '100dvh', background: '#16191E' }}
      >
        <span className="text-sm" style={{ color: '#ef4444' }}>
          {error || '게시글을 찾을 수 없습니다'}
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

  const categoryColor: Record<string, { bg: string; text: string }> = {
    status: { bg: '#14532d', text: '#4ade80' },
    review: { bg: '#1e3a5f', text: '#60a5fa' },
    tip: { bg: '#3b2a00', text: '#fbbf24' },
    free: { bg: '#2a2d33', text: '#aaaaaa' },
  };
  const catStyle = categoryColor[post.category] || categoryColor.free;

  return (
    <div style={{ background: '#16191E', minHeight: '100dvh', paddingBottom: '72px' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-20 flex items-center gap-3 px-4"
        style={{
          height: '52px',
          background: '#16191E',
          borderBottom: '1px solid #2a2d33',
        }}
      >
        <BackButton />
        <span className="font-semibold text-sm" style={{ color: '#ffffff' }}>
          커뮤니티
        </span>
      </header>

      {/* Post Header */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid #2a2d33' }}>
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-xs px-2 py-0.5 font-medium"
            style={{
              background: catStyle.bg,
              color: catStyle.text,
              borderRadius: '4px',
            }}
          >
            {getCategoryLabel(post.category)}
          </span>
          {post.spot && (
            <span className="text-xs" style={{ color: '#888888' }}>
              {post.spot.name}
            </span>
          )}
        </div>
        <h1 className="font-bold text-base leading-snug" style={{ color: '#ffffff' }}>
          {post.title}
        </h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs" style={{ color: '#888888' }}>
            {post.nickname}
          </span>
          <span className="text-xs" style={{ color: '#555555' }}>
            {relativeTime(post.created_at)}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4" style={{ borderBottom: '1px solid #2a2d33' }}>
        <p
          className="text-sm leading-relaxed"
          style={{ color: '#cccccc', whiteSpace: 'pre-wrap' }}
        >
          {post.content}
        </p>

        {/* Images */}
        {post.image_urls && post.image_urls.length > 0 && (
          <div
            className="flex gap-2 mt-4 overflow-x-auto"
            style={{ scrollbarWidth: 'none' }}
          >
            {post.image_urls.map((url, idx) => (
              <div
                key={idx}
                className="relative flex-shrink-0"
                style={{
                  width: '180px',
                  height: '180px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  background: '#2a2d33',
                }}
              >
                <Image
                  src={url}
                  alt={`이미지 ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="180px"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ borderBottom: '1px solid #2a2d33' }}
      >
        <LikeButton
          targetType="post"
          targetId={post.id}
          initialCount={post.like_count}
        />
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
          style={{
            background: '#2a2d33',
            color: '#aaaaaa',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span>🔗</span>
          <span>공유</span>
        </button>
        <button
          onClick={handleReport}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium ml-auto"
          style={{
            background: 'transparent',
            color: reportSent ? '#555555' : '#ef4444',
            borderRadius: '8px',
            border: 'none',
            cursor: reportSent ? 'default' : 'pointer',
          }}
          disabled={reportSent}
        >
          {reportSent ? '신고됨' : '신고'}
        </button>
      </div>

      {/* Ad Banner */}
      <div className="flex justify-center py-3">
        <AdBannerInline size="320x100" />
      </div>

      {/* Comment Section */}
      <div style={{ borderTop: '1px solid #2a2d33' }}>
        <CommentSection postId={post.id} />
      </div>
    </div>
  );
}

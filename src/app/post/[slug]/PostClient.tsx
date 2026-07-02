'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import ReportModal from '@/components/ReportModal';
import SharedLikeButton from '@/components/LikeButton';
import { Post } from '@/lib/types';
import { relativeTime, getCategoryLabel, getFingerprint } from '@/lib/utils';
import { usePageDwell } from '@/lib/hooks/usePageDwell';
import { useScrollDepth } from '@/lib/hooks/useScrollDepth';
import { isBlockedNick } from '@/lib/blocklist';

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
  const [loading, setLoading] = useState(false);

  const handleLike = async () => {
    if (loading) return; // guard: no concurrent toggles → no duplicate likes
    setLoading(true);
    try {
      // Per-type routes (service-role, persist the count). The old generic
      // /api/likes endpoint never existed → post likes 404'd silently.
      const path =
        targetType === 'post'
          ? `/api/posts/${targetId}/like`
          : targetType === 'comment'
            ? `/api/comments/${targetId}/like`
            : `/api/spots/${targetId}/like`;
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fingerprint: getFingerprint() }),
      });
      if (res.ok) {
        // Mirror the server's authoritative state — no optimistic drift.
        const data = (await res.json()) as { liked: boolean; count: number };
        setLiked(data.liked);
        setCount(data.count);
      }
    } catch (err) {
      console.error('Like error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLike}
      disabled={loading}
      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium"
      style={{
        background: liked ? '#111827' : '#f8f9fa',
        color: liked ? '#ffffff' : '#6b7280',
        borderRadius: '8px',
        border: liked ? '1.5px solid #111827' : '1.5px solid #e5e7eb',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.6 : 1,
      }}
    >
      <span>{liked ? '♥' : '♡'}</span>
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
  // Reply form keeps its own state so the top "new comment" form stays
  // usable at the same time as an open reply box.
  const [replyNickname, setReplyNickname] = useState('');
  const [replyPassword, setReplyPassword] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyError, setReplyError] = useState('');
  const [report, setReport] = useState<{ id: string; nick: string } | null>(null);
  const [, bumpBlocked] = useState(0);

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
        body: JSON.stringify({ post_id: postId, nickname, password, content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `댓글 등록 실패 (${res.status})`);
      }
      const newComment = await res.json();
      setComments((prev) => [{ ...newComment, replies: [] }, ...prev]);
      setContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReplySubmit = async (e: React.FormEvent, parentId: string) => {
    e.preventDefault();
    if (!replyNickname.trim() || !replyPassword.trim() || !replyContent.trim()) return;
    setReplyError('');
    if (replyPassword.length < 4) {
      setReplyError('비밀번호는 4자 이상이어야 합니다.');
      return;
    }
    setReplySubmitting(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: postId,
          parent_id: parentId,
          nickname: replyNickname,
          password: replyPassword,
          content: replyContent,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `답글 등록 실패 (${res.status})`);
      }
      const newReply = await res.json();
      setComments((prev) =>
        prev.map((c) =>
          c.id === parentId ? { ...c, replies: [...(c.replies || []), newReply] } : c,
        ),
      );
      setReplyContent('');
      setReplyPassword('');
      setReplyNickname('');
      setReplyTo(null);
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setReplySubmitting(false);
    }
  };

  // Form JSX, used twice with independent state: the top form for a new
  // top-level comment (isReply=false), and an inline form under a comment
  // when replying (isReply=true) so both can be open at once.
  const renderForm = (isReply: boolean, parentId?: string) => {
    const nick = isReply ? replyNickname : nickname;
    const setNick = isReply ? setReplyNickname : setNickname;
    const pw = isReply ? replyPassword : password;
    const setPw = isReply ? setReplyPassword : setPassword;
    const text = isReply ? replyContent : content;
    const setText = isReply ? setReplyContent : setContent;
    const busy = isReply ? replySubmitting : submitting;
    const err = isReply ? replyError : error;
    const disabled = busy || !nick.trim() || !pw.trim() || !text.trim();
    return (
      <form
        onSubmit={(e) => (isReply ? handleReplySubmit(e, parentId!) : handleSubmit(e))}
        className="flex flex-col gap-2"
      >
        <div className="flex gap-2">
          <input
            placeholder="닉네임"
            value={nick}
            onChange={(e) => setNick(e.target.value)}
            className="flex-1 px-3 py-2 text-sm"
            style={{ background: '#f9fafb', color: '#111827', border: '1px solid #e5e7eb', borderRadius: '8px' }}
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="flex-1 px-3 py-2 text-sm"
            style={{ background: '#f9fafb', color: '#111827', border: '1px solid #e5e7eb', borderRadius: '8px' }}
          />
        </div>
        <textarea
          placeholder={isReply ? '답글을 남겨주세요' : '댓글을 남겨주세요'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm resize-none"
          style={{ background: '#f9fafb', color: '#111827', border: '1px solid #e5e7eb', borderRadius: '8px' }}
        />
        <p className="text-xs" style={{ color: '#9ca3af' }}>
          비밀번호는 4자 이상 · 댓글 수정·삭제할 때 쓰여요
        </p>
        {err && <p className="text-xs" style={{ color: '#ef4444' }}>{err}</p>}
        <div className="flex items-center justify-end gap-3">
          {isReply && (
            <button
              type="button"
              onClick={() => {
                setReplyTo(null);
                setReplyError('');
              }}
              className="text-xs"
              style={{ color: '#6b7280' }}
            >
              취소
            </button>
          )}
          <button
            type="submit"
            disabled={disabled}
            className="px-4 py-2 text-sm font-medium"
            style={{
              background: '#111827',
              color: '#ffffff',
              borderRadius: '8px',
              opacity: disabled ? 0.4 : 1,
            }}
          >
            {busy ? '등록 중...' : isReply ? '답글 등록' : '등록'}
          </button>
        </div>
      </form>
    );
  };

  return (
    <div className="px-4 py-4">
      <p className="font-semibold text-sm mb-3" style={{ color: '#111827' }}>
        댓글 {comments.length > 0 && `(${comments.length})`}
      </p>

      <div className="mb-4">{renderForm(false)}</div>

      <div className="divide-y" style={{ borderColor: '#f3f4f6' }}>
        {comments.filter((c) => !isBlockedNick(c.nickname)).map((c) => (
          <div key={c.id} className="py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold" style={{ color: '#111827' }}>
                {c.nickname}
              </span>
              <span className="text-xs" style={{ color: '#d1d5db' }}>
                {relativeTime(c.created_at)}
              </span>
              <button
                onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
                className="ml-auto text-xs"
                style={{ color: replyTo === c.id ? '#111827' : '#6b7280', fontWeight: replyTo === c.id ? 600 : 400 }}
              >
                답글
              </button>
              <button
                onClick={() => setReport({ id: c.id, nick: c.nickname })}
                className="text-xs"
                style={{ color: '#9ca3af' }}
              >
                신고
              </button>
            </div>
            <p className="text-sm" style={{ color: '#374151', whiteSpace: 'pre-wrap' }}>
              {c.content}
            </p>
            <div className="mt-1">
              <SharedLikeButton targetType="comment" targetId={c.id} initialCount={c.like_count} />
            </div>

            {replyTo === c.id && (
              <div className="mt-2 pl-3 border-l-2" style={{ borderColor: '#e5e7eb' }}>
                {renderForm(true, c.id)}
              </div>
            )}

            {c.replies && c.replies.length > 0 && (
              <div
                className="mt-2 pl-3 border-l-2"
                style={{ borderColor: '#e5e7eb' }}
              >
                {c.replies.filter((r) => !isBlockedNick(r.nickname)).map((r) => (
                  <div key={r.id} className="py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold" style={{ color: '#111827' }}>
                        {r.nickname}
                      </span>
                      <span className="text-xs" style={{ color: '#d1d5db' }}>
                        {relativeTime(r.created_at)}
                      </span>
                      <button
                        onClick={() => setReport({ id: r.id, nick: r.nickname })}
                        className="ml-auto text-xs"
                        style={{ color: '#9ca3af' }}
                      >
                        신고
                      </button>
                    </div>
                    <p className="text-sm" style={{ color: '#374151', whiteSpace: 'pre-wrap' }}>
                      {r.content}
                    </p>
                    <div className="mt-1">
                      <SharedLikeButton targetType="comment" targetId={r.id} initialCount={r.like_count} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <ReportModal
        open={!!report}
        onClose={() => setReport(null)}
        targetType="comment"
        targetId={report?.id || ''}
        authorNickname={report?.nick}
        onBlocked={() => bumpBlocked((n) => n + 1)}
      />
    </div>
  );
}

// ---- Main Page ----

type PostView = Pick<
  Post,
  'id' | 'title' | 'content' | 'nickname' | 'created_at' | 'image_urls' | 'like_count'
> & { category: string; spot?: { name: string } | null };

export default function PostPage({ initialPost = null }: { initialPost?: PostView | null }) {
  const params = useParams();
  const slug = params.slug as string;

  // Seed from the server-fetched post so the title/body render during SSR
  // instead of a spinner. Near-empty SSR HTML was letting Google override the
  // self-canonical (GSC "중복, 구글이 다른 표준 선택"). The client refetch below
  // still refreshes like_count / spot.
  const [post, setPost] = useState<PostView | null>(initialPost);
  const [loading, setLoading] = useState(!initialPost);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  usePageDwell('post', slug);
  useScrollDepth('post', slug);

  useEffect(() => {
    const fetchPost = async () => {
      setError(null);
      try {
        const res = await fetch(`/api/posts/${encodeURIComponent(slug)}`);
        if (!res.ok) throw new Error(`게시글을 불러오지 못했습니다 (${res.status})`);
        setPost(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetchPost();
  }, [slug]);

  const handleShare = async () => {
    try {
      await navigator.share({ title: post?.title, url: window.location.href });
    } catch {
      await navigator.clipboard.writeText(window.location.href);
      alert('링크가 복사되었습니다');
    }
  };


  if (loading) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: '100dvh', background: '#ffffff' }}
      >
        <span className="text-sm" style={{ color: '#9ca3af' }}>
          불러오는 중...
        </span>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3"
        style={{ height: '100dvh', background: '#ffffff' }}
      >
        <span className="text-sm" style={{ color: '#ef4444' }}>
          {error || '게시글을 찾을 수 없습니다'}
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

  const categoryColor: Record<string, { bg: string; text: string }> = {
    status: { bg: '#dcfce7', text: '#15803d' },
    review: { bg: '#dbeafe', text: '#1d4ed8' },
    tip: { bg: '#fef3c7', text: '#92400e' },
    free: { bg: '#f3f4f6', text: '#4b5563' },
  };
  const catStyle = categoryColor[post.category] || categoryColor.free;

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
        <span className="font-semibold text-sm" style={{ color: '#111827' }}>
          커뮤니티
        </span>
      </header>

      {/* Post Header */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid #f3f4f6' }}>
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
            <span className="text-xs" style={{ color: '#9ca3af' }}>
              {post.spot.name}
            </span>
          )}
        </div>
        <h1 className="font-bold text-base leading-snug" style={{ color: '#111827' }}>
          {post.title}
        </h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs font-medium" style={{ color: '#6b7280' }}>
            {post.nickname}
          </span>
          <span className="text-xs" style={{ color: '#d1d5db' }} suppressHydrationWarning>
            {relativeTime(post.created_at)}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
        <p
          className="text-sm leading-relaxed"
          style={{ color: '#374151', whiteSpace: 'pre-wrap' }}
        >
          {post.content}
        </p>

        {post.image_urls && post.image_urls.length > 0 && (
          <div
            className="flex gap-2 mt-4 overflow-x-auto hide-scrollbar"
          >
            {post.image_urls.map((url, idx) => (
              <div
                key={idx}
                className="relative flex-shrink-0"
                style={{
                  width: '180px',
                  height: '180px',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  background: '#f3f4f6',
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
        style={{ borderBottom: '1px solid #f3f4f6' }}
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
            background: '#f8f9fa',
            color: '#6b7280',
            borderRadius: '8px',
            border: '1.5px solid #e5e7eb',
            cursor: 'pointer',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          <span>공유</span>
        </button>
        <button
          onClick={() => setReportOpen(true)}
          className="flex items-center gap-1 px-3 py-2 text-xs font-medium ml-auto"
          style={{
            background: 'transparent',
            color: '#ef4444',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          신고
        </button>
      </div>

      {/* Comment Section */}
      <div style={{ borderTop: '1px solid #f3f4f6' }}>
        <CommentSection postId={post.id} />
      </div>

      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="post"
        targetId={post.id}
        authorNickname={post.nickname}
        onBlocked={() => window.history.back()}
      />
    </div>
  );
}

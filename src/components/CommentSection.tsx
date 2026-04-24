'use client';

import { useState, useEffect, useCallback } from 'react';
import { Comment } from '@/lib/types';
import { relativeTime } from '@/lib/utils';
import { generateNickname } from '@/lib/nickname';
import NicknameInput from './NicknameInput';
import LikeButton from './LikeButton';
import ReportModal from './ReportModal';

interface CommentSectionProps {
  postId?: string;
  spotId?: string;
  allowReplies?: boolean;
}

interface CommentItemProps {
  comment: Comment;
  allowReplies: boolean;
  onReplySubmit: (parentId: string, nickname: string, password: string, content: string) => Promise<void>;
  onDelete: (commentId: string, password: string) => Promise<void>;
  depth?: number;
}

function CommentItem({ comment, allowReplies, onReplySubmit, onDelete, depth = 0 }: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyNickname, setReplyNickname] = useState(() => generateNickname());
  const [replyPassword, setReplyPassword] = useState('');
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteInput, setShowDeleteInput] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [reportOpen, setReportOpen] = useState(false);

  async function handleReply() {
    if (!replyContent.trim() || replyPassword.length < 4 || submitting) return;
    setSubmitting(true);
    try {
      await onReplySubmit(comment.id, replyNickname, replyPassword, replyContent);
      setReplyContent('');
      setReplyPassword('');
      setReplyNickname(generateNickname());
      setShowReplyForm(false);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deletePassword) return;
    await onDelete(comment.id, deletePassword);
    setShowDeleteInput(false);
    setDeletePassword('');
  }

  return (
    <div style={{ marginLeft: depth > 0 ? '24px' : '0', borderLeft: depth > 0 ? '2px solid #2a2d33' : 'none', paddingLeft: depth > 0 ? '12px' : '0' }}>
      <div className="py-3" style={{ borderBottom: '1px solid #2a2d33' }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold" style={{ color: '#F59E0B' }}>
                {comment.nickname}
              </span>
              <span className="text-xs" style={{ color: '#888888' }}>
                {relativeTime(comment.created_at)}
              </span>
            </div>
            <p className="text-sm" style={{ color: '#e0e0e0', wordBreak: 'break-word' }}>
              {comment.content}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <LikeButton targetType="comment" targetId={comment.id} initialCount={comment.like_count} />
              {allowReplies && depth === 0 && (
                <button
                  onClick={() => setShowReplyForm((v) => !v)}
                  className="text-xs"
                  style={{ color: '#888888', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  답글
                </button>
              )}
              <button
                onClick={() => setReportOpen(true)}
                className="text-xs"
                style={{ color: '#888888', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                신고
              </button>
              <button
                onClick={() => setShowDeleteInput((v) => !v)}
                className="text-xs"
                style={{ color: '#888888', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ···
              </button>
            </div>
          </div>
        </div>
        <ReportModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="comment"
          targetId={comment.id}
        />

        {showDeleteInput && (
          <div className="flex gap-2 mt-2">
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              placeholder="비밀번호 입력 후 삭제"
              className="flex-1 px-2 py-1 text-xs outline-none"
              style={{ background: '#1e2127', border: '1px solid #3a3d43', borderRadius: '6px', color: '#fff' }}
            />
            <button
              onClick={handleDelete}
              className="px-3 py-1 text-xs"
              style={{ background: '#EF4444', color: '#fff', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
            >
              삭제
            </button>
          </div>
        )}

        {showReplyForm && allowReplies && depth === 0 && (
          <div className="mt-3 p-3 rounded-lg" style={{ background: '#1e2127' }}>
            <NicknameInput
              nickname={replyNickname}
              password={replyPassword}
              onNicknameChange={setReplyNickname}
              onPasswordChange={setReplyPassword}
            />
            <div className="flex gap-2 mt-2">
              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="답글을 입력하세요"
                rows={2}
                className="flex-1 px-3 py-2 text-sm outline-none resize-none"
                style={{ background: '#2a2d33', border: '1px solid #3a3d43', borderRadius: '8px', color: '#fff' }}
              />
              <button
                onClick={handleReply}
                disabled={submitting || !replyContent.trim() || replyPassword.length < 4}
                className="px-3 py-2 text-sm font-medium self-end"
                style={{
                  background: submitting || !replyContent.trim() || replyPassword.length < 4 ? '#3a3d43' : '#F59E0B',
                  color: '#fff',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                등록
              </button>
            </div>
          </div>
        )}
      </div>

      {comment.replies && comment.replies.length > 0 && allowReplies && (
        <div>
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              allowReplies={false}
              onReplySubmit={onReplySubmit}
              onDelete={onDelete}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentSection({ postId, spotId, allowReplies = false }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [nickname, setNickname] = useState(() => generateNickname());
  const [password, setPassword] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (postId) params.set('post_id', postId);
      if (spotId) params.set('spot_id', spotId);
      const res = await fetch(`/api/comments?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [postId, spotId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function handleSubmit() {
    if (!content.trim() || password.length < 4 || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: postId,
          spot_id: spotId,
          nickname,
          password,
          content: content.trim(),
        }),
      });
      if (res.ok) {
        setContent('');
        setPassword('');
        setNickname(generateNickname());
        await fetchComments();
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReplySubmit(parentId: string, rNickname: string, rPassword: string, rContent: string) {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        post_id: postId,
        spot_id: spotId,
        parent_id: parentId,
        nickname: rNickname,
        password: rPassword,
        content: rContent.trim(),
      }),
    });
    if (res.ok) {
      await fetchComments();
    }
  }

  async function handleDelete(commentId: string, pw: string) {
    const res = await fetch(`/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (res.ok) {
      await fetchComments();
    }
  }

  return (
    <div className="px-4 py-4" style={{ background: '#16191E' }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: '#ffffff' }}>
        댓글 {comments.length}개
      </h3>

      {/* 입력폼 */}
      <div className="mb-4 p-3 rounded-lg" style={{ background: '#1e2127' }}>
        <NicknameInput
          nickname={nickname}
          password={password}
          onNicknameChange={setNickname}
          onPasswordChange={setPassword}
        />
        <div className="flex gap-2 mt-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="댓글을 입력하세요"
            rows={3}
            className="flex-1 px-3 py-2 text-sm outline-none resize-none"
            style={{ background: '#2a2d33', border: '1px solid #3a3d43', borderRadius: '8px', color: '#fff' }}
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !content.trim() || password.length < 4}
            className="px-4 py-2 text-sm font-semibold self-end"
            style={{
              background: submitting || !content.trim() || password.length < 4 ? '#3a3d43' : '#F59E0B',
              color: '#fff',
              borderRadius: '8px',
              border: 'none',
              cursor: submitting ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            등록
          </button>
        </div>
      </div>

      {/* 댓글 리스트 */}
      {loading ? (
        <p className="text-sm text-center py-4" style={{ color: '#888888' }}>
          불러오는 중...
        </p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-center py-4" style={{ color: '#888888' }}>
          첫 댓글을 남겨보세요
        </p>
      ) : (
        <div>
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              allowReplies={allowReplies}
              onReplySubmit={handleReplySubmit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

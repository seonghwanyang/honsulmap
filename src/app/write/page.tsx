'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { POST_CATEGORIES, PostCategory, Spot } from '@/lib/types';

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

const WRITE_CATEGORIES = POST_CATEGORIES.filter((c) => c.value !== 'all') as {
  value: PostCategory;
  label: string;
}[];

const SPOT_REQUIRED_CATEGORIES: PostCategory[] = ['status', 'review'];

export default function WritePage() {
  const router = useRouter();

  const [category, setCategory] = useState<PostCategory>('free');
  const [spotId, setSpotId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [spots, setSpots] = useState<Spot[]>([]);
  const [spotsLoading, setSpotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const needsSpot = SPOT_REQUIRED_CATEGORIES.includes(category);

  const fetchSpots = useCallback(async () => {
    if (spots.length > 0) return;
    setSpotsLoading(true);
    try {
      const res = await fetch('/api/spots');
      if (!res.ok) throw new Error('가게 목록을 불러오지 못했습니다');
      const data: Spot[] = await res.json();
      setSpots(data);
    } catch (err) {
      console.error('Spots fetch error:', err);
    } finally {
      setSpotsLoading(false);
    }
  }, [spots.length]);

  useEffect(() => {
    if (needsSpot) fetchSpots();
  }, [needsSpot, fetchSpots]);

  useEffect(() => {
    if (!needsSpot) setSpotId('');
  }, [needsSpot]);

  const isValid =
    nickname.trim() &&
    password.length >= 4 &&
    title.trim() &&
    content.trim() &&
    (!needsSpot || spotId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (password.length < 4) {
      setError('비밀번호는 4자 이상이어야 합니다.');
      return;
    }
    if (!isValid) return;
    setSubmitting(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        category,
        title: title.trim(),
        content: content.trim(),
        nickname: nickname.trim(),
        password,
      };
      if (spotId) body.spot_id = spotId;

      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || data.message || `등록 실패 (${res.status})`);
      }
      router.push('/community');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setSubmitting(false);
    }
  };

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
          글쓰기
        </span>
      </header>

      <form onSubmit={handleSubmit} className="px-4 pt-4 pb-24 flex flex-col gap-4">
        {/* Nickname & Password */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b7280' }}>
            닉네임 &amp; 비밀번호
          </label>
          <div className="flex gap-2">
            <input
              placeholder="닉네임"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={20}
              className="flex-1 px-3 py-2.5 text-sm"
              style={{
                background: '#f9fafb',
                color: '#111827',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
            />
            <input
              type="password"
              placeholder="비밀번호 (4자 이상)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={30}
              className="flex-1 px-3 py-2.5 text-sm"
              style={{
                background: '#f9fafb',
                color: '#111827',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
            />
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b7280' }}>
            카테고리
          </label>
          <div className="flex gap-2 flex-wrap">
            {WRITE_CATEGORIES.map((cat) => {
              const isSelected = category === cat.value;
              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className="px-4 py-2 text-sm font-medium"
                  style={{
                    borderRadius: '999px',
                    background: isSelected ? '#111827' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#6b7280',
                    border: isSelected ? '1.5px solid #111827' : '1.5px solid #e5e7eb',
                    cursor: 'pointer',
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Spot selector */}
        {needsSpot && (
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b7280' }}>
              가게 선택 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              value={spotId}
              onChange={(e) => setSpotId(e.target.value)}
              disabled={spotsLoading}
              className="w-full px-3 py-2.5 text-sm"
              style={{
                background: '#f9fafb',
                color: spotId ? '#111827' : '#9ca3af',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
              }}
            >
              <option value="">
                {spotsLoading ? '불러오는 중...' : '가게를 선택하세요'}
              </option>
              {spots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b7280' }}>
            제목
          </label>
          <input
            placeholder="제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            className="w-full px-3 py-2.5 text-sm"
            style={{
              background: '#f9fafb',
              color: '#111827',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
        </div>

        {/* Content */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b7280' }}>
            내용
          </label>
          <textarea
            placeholder="내용을 입력하세요"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={8}
            maxLength={2000}
            className="w-full px-3 py-2.5 text-sm resize-none"
            style={{
              background: '#f9fafb',
              color: '#111827',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <p className="text-right text-xs mt-1" style={{ color: '#d1d5db' }}>
            {content.length} / 2000
          </p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm" style={{ color: '#ef4444' }}>
            {error}
          </p>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isValid || submitting}
          className="w-full py-3 text-base font-semibold"
          style={{
            background: isValid && !submitting ? '#111827' : '#e5e7eb',
            color: isValid && !submitting ? '#ffffff' : '#9ca3af',
            borderRadius: '10px',
            border: 'none',
            cursor: isValid && !submitting ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s',
          }}
        >
          {submitting ? '등록 중...' : '등록하기'}
        </button>
      </form>
    </div>
  );
}

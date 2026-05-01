'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { POST_CATEGORIES, PostCategory, Spot } from '@/lib/types';
import { supabase } from '@/lib/supabase';

const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const STORAGE_BUCKET = 'post-images';

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

const HELP_TEXT = '#9ca3af';

export default function WritePage() {
  const router = useRouter();

  const [category, setCategory] = useState<PostCategory>('free');
  const [spotId, setSpotId] = useState('');
  const [spotQuery, setSpotQuery] = useState('');
  const [spotOpen, setSpotOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [spots, setSpots] = useState<Spot[]>([]);
  const [spotsLoading, setSpotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const spotRef = useRef<HTMLDivElement>(null);
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
    if (!needsSpot) {
      setSpotId('');
      setSpotQuery('');
    }
  }, [needsSpot]);

  // Close combobox when clicking outside
  useEffect(() => {
    if (!spotOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (spotRef.current && !spotRef.current.contains(e.target as Node)) {
        setSpotOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [spotOpen]);

  const filteredSpots = useMemo(() => {
    const q = spotQuery.trim().toLowerCase();
    if (!q) return spots.slice(0, 15);
    return spots.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 15);
  }, [spots, spotQuery]);

  const selectSpot = (spot: Spot) => {
    setSpotId(spot.id);
    setSpotQuery(spot.name);
    setSpotOpen(false);
  };

  const onSpotInput = (v: string) => {
    setSpotQuery(v);
    setSpotId(''); // typing invalidates the previous selection
    setSpotOpen(true);
  };

  const nicknameOk = nickname.trim().length >= 2 && nickname.trim().length <= 20;
  const passwordOk = password.length >= 4;
  const titleOk = title.trim().length >= 1 && title.trim().length <= 100;
  const contentOk = content.trim().length >= 1 && content.trim().length <= 2000;
  const spotOk = !needsSpot || spotId !== '' || spotQuery.trim().length >= 2;

  const isValid = nicknameOk && passwordOk && titleOk && contentOk && spotOk;

  const firstIssue = (): string | null => {
    if (!nicknameOk) return '닉네임은 2~20자로 입력해주세요.';
    if (!passwordOk) return '비밀번호는 4자 이상이어야 해요.';
    if (needsSpot && !spotId && spotQuery.trim().length < 2) {
      return '가게를 선택하거나 이름을 2자 이상 입력해주세요.';
    }
    if (!titleOk) return '제목을 1~100자로 입력해주세요.';
    if (!contentOk) return '내용을 1~2000자로 입력해주세요.';
    return null;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files ?? []);
    e.target.value = ''; // reset so the same file can be re-picked later
    if (!incoming.length) return;
    const room = MAX_IMAGES - imageFiles.length;
    if (room <= 0) {
      setError(`이미지는 최대 ${MAX_IMAGES}개까지 첨부할 수 있어요.`);
      return;
    }
    const accepted: File[] = [];
    for (const f of incoming.slice(0, room)) {
      if (!f.type.startsWith('image/')) continue;
      if (f.size > MAX_IMAGE_BYTES) {
        setError('각 이미지는 5MB를 넘을 수 없어요.');
        continue;
      }
      accepted.push(f);
    }
    if (!accepted.length) return;
    setImageFiles((prev) => [...prev, ...accepted]);
    setPreviewUrls((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))]);
    setError('');
  };

  const removeImage = (idx: number) => {
    setPreviewUrls((prev) => {
      const url = prev[idx];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== idx);
    });
    setImageFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Clean up all preview object URLs on unmount
  useEffect(() => {
    return () => {
      previewUrls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uploadImages = useCallback(async (): Promise<string[]> => {
    if (imageFiles.length === 0) return [];
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of imageFiles) {
        const ext =
          (file.name.split('.').pop() || file.type.split('/')[1] || 'jpg')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '') || 'jpg';
        const path = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw new Error(`이미지 업로드 실패: ${upErr.message}`);
        const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        urls.push(data.publicUrl);
      }
      return urls;
    } finally {
      setUploading(false);
    }
  }, [imageFiles]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const issue = firstIssue();
    if (issue) {
      setError(issue);
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const image_urls = await uploadImages();

      const body: Record<string, unknown> = {
        category,
        title: title.trim(),
        content: content.trim(),
        nickname: nickname.trim(),
        password,
      };
      if (spotId) {
        body.spot_id = spotId;
      } else if (needsSpot && spotQuery.trim()) {
        body.spot_name = spotQuery.trim();
      }
      if (image_urls.length > 0) {
        body.image_urls = image_urls;
      }

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

  const showFreeTextHint = needsSpot && !spotId && spotQuery.trim().length >= 2;

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
        {/* Nickname */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b7280' }}>
            닉네임
          </label>
          <input
            placeholder="닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            className="w-full px-3 py-2.5 text-sm"
            style={{ background: '#f9fafb', color: '#111827', border: '1px solid #e5e7eb', borderRadius: '8px' }}
          />
          <p className="text-xs mt-1" style={{ color: HELP_TEXT }}>
            2~20자 · 게시글 작성 시 표시됩니다
          </p>
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b7280' }}>
            비밀번호
          </label>
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            maxLength={30}
            className="w-full px-3 py-2.5 text-sm"
            style={{ background: '#f9fafb', color: '#111827', border: '1px solid #e5e7eb', borderRadius: '8px' }}
          />
          <p className="text-xs mt-1" style={{ color: HELP_TEXT }}>
            4자 이상 · 게시글 수정·삭제할 때 사용해요
          </p>
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
          <p className="text-xs mt-1.5" style={{ color: HELP_TEXT }}>
            현황·후기는 가게 정보가 필요해요. 자유·꿀팁은 없어도 됩니다.
          </p>
        </div>

        {/* Spot combobox */}
        {needsSpot && (
          <div ref={spotRef} className="relative">
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b7280' }}>
              가게 <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              placeholder={spotsLoading ? '불러오는 중...' : '가게 이름으로 검색 (없으면 직접 입력)'}
              value={spotQuery}
              onChange={(e) => onSpotInput(e.target.value)}
              onFocus={() => setSpotOpen(true)}
              disabled={spotsLoading}
              className="w-full px-3 py-2.5 text-sm"
              style={{ background: '#f9fafb', color: '#111827', border: '1px solid #e5e7eb', borderRadius: '8px' }}
            />
            {spotOpen && filteredSpots.length > 0 && (
              <ul
                className="absolute z-10 left-0 right-0 mt-1 max-h-60 overflow-y-auto py-1"
                style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
              >
                {filteredSpots.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => selectSpot(s)}
                      className="w-full text-left px-3 py-2 text-sm"
                      style={{ color: '#111827' }}
                    >
                      {s.name}
                      {s.address && (
                        <span className="block text-xs" style={{ color: '#9ca3af' }}>
                          {s.address}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs mt-1" style={{ color: HELP_TEXT }}>
              {showFreeTextHint
                ? `"${spotQuery.trim()}" 이름 그대로 등록돼요 (목록에 없는 가게)`
                : '검색해서 선택하거나, 목록에 없는 가게면 이름을 그대로 입력하세요'}
            </p>
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
            style={{ background: '#f9fafb', color: '#111827', border: '1px solid #e5e7eb', borderRadius: '8px' }}
          />
          <p className="text-xs mt-1" style={{ color: HELP_TEXT }}>
            1~100자
          </p>
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
            style={{ background: '#f9fafb', color: '#111827', border: '1px solid #e5e7eb', borderRadius: '8px' }}
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs" style={{ color: HELP_TEXT }}>
              1~2000자
            </p>
            <p className="text-xs" style={{ color: '#d1d5db' }}>
              {content.length} / 2000
            </p>
          </div>
        </div>

        {/* Photos */}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#6b7280' }}>
            사진 첨부 <span style={{ color: HELP_TEXT, fontWeight: 400 }}>(선택, 최대 {MAX_IMAGES}장)</span>
          </label>

          {previewUrls.length > 0 && (
            <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-2 pb-1">
              {previewUrls.map((url, i) => (
                <div
                  key={url}
                  className="relative flex-shrink-0"
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 8,
                    overflow: 'hidden',
                    background: '#f3f4f6',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`첨부 사진 ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    aria-label="사진 제거"
                    className="absolute top-1 right-1 flex items-center justify-center"
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: 'rgba(17,24,39,0.7)',
                      color: '#ffffff',
                      fontSize: 12,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {imageFiles.length < MAX_IMAGES && (
            <label
              className="flex items-center justify-center gap-2 w-full cursor-pointer"
              style={{
                background: '#f9fafb',
                border: '1px dashed #d1d5db',
                borderRadius: 8,
                padding: '11px 12px',
                fontSize: 13,
                color: '#6b7280',
              }}
            >
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
              사진 선택 ({imageFiles.length}/{MAX_IMAGES})
            </label>
          )}
          <p className="text-xs mt-1" style={{ color: HELP_TEXT }}>
            한 장당 5MB 이하 · 모바일에서 카메라 또는 사진첩에서 선택
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
          disabled={submitting}
          className="w-full py-3 text-base font-semibold"
          style={{
            background: isValid && !submitting ? '#111827' : '#e5e7eb',
            color: isValid && !submitting ? '#ffffff' : '#9ca3af',
            borderRadius: '10px',
            border: 'none',
            cursor: submitting ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {uploading ? '사진 업로드 중...' : submitting ? '등록 중...' : '등록하기'}
        </button>
      </form>
    </div>
  );
}

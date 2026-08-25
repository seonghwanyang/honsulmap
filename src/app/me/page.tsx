'use client';

import { useEffect, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useUser } from '@/lib/useUser';
import { createBrowserSupabase } from '@/lib/supabase/client';
import LoginModal from '@/components/LoginModal';
import { getRegionLabel, getCategoryLabel } from '@/lib/utils';
import { chatNick, chatAvatar } from '@/lib/chatNick';

interface FavSpot {
  id: string;
  name: string;
  slug: string;
  region: string;
  category: string;
  has_fresh_story: boolean;
}

export default function MyPage() {
  const { user, loading } = useUser();
  const [loginOpen, setLoginOpen] = useState(false);
  const [favs, setFavs] = useState<FavSpot[] | null>(null);
  const [optedIn, setOptedIn] = useState<boolean | null>(null);
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');

  useEffect(() => {
    if (!user) {
      setFavs(null);
      setOptedIn(null);
      setProfileLoaded(false);
      setNickname('');
      setAvatarUrl(null);
      return;
    }
    let alive = true;
    fetch('/api/me/favorites')
      .then((r) => (r.ok ? r.json() : { favorites: [] }))
      .then((d) => {
        if (alive) setFavs(d.favorites ?? []);
      })
      .catch(() => {
        if (alive) setFavs([]);
      });
    fetch('/api/me/marketing-consent')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) setOptedIn(!!d.opted_in);
      })
      .catch(() => {});
    fetch('/api/me/profile')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d) {
          setNickname(d.nickname ?? '');
          setAvatarUrl(d.avatar_url ?? null);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setProfileLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  const logout = async () => {
    await createBrowserSupabase().auth.signOut();
    window.location.href = '/';
  };

  const toggleConsent = async () => {
    if (optedIn === null) return;
    const next = !optedIn;
    setOptedIn(next);
    try {
      await fetch('/api/me/marketing-consent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opted_in: next, source: 'me_toggle' }),
      });
    } catch {
      setOptedIn(!next);
    }
  };

  const onPickAvatar = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      setProfileErr('이미지 파일만 올릴 수 있어요.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setProfileErr('이미지는 2MB 이하로 올려주세요.');
      return;
    }
    setProfileErr('');
    setProfileMsg('');
    setUploadingAvatar(true);
    try {
      const supabase = createBrowserSupabase();
      const ext =
        (file.name.split('.').pop() || file.type.split('/')[1] || 'jpg')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw new Error(upErr.message);
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
    } catch (err) {
      setProfileErr('사진 업로드에 실패했어요. ' + (err as Error).message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileErr('');
    setProfileMsg('');
    try {
      const res = await fetch('/api/me/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, avatar_url: avatarUrl }),
      });
      const b = await res.json();
      if (!res.ok) throw new Error(b.error || '저장에 실패했어요.');
      setNickname(b.nickname ?? '');
      setAvatarUrl(b.avatar_url ?? null);
      setProfileMsg('저장됐어요.');
    } catch (err) {
      setProfileErr((err as Error).message);
    } finally {
      setSavingProfile(false);
    }
  };

  const defaultNick = user ? chatNick(user.id) : '';
  const defaultAvatar = user ? chatAvatar(user.id) : { emoji: '🐶', color: '#f3f4f6' };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '12px 16px 80px' }}>
      {/* Top bar */}
      <div className="flex items-center gap-2" style={{ height: 48 }}>
        <Link href="/" aria-label="지도로" style={{ color: '#6b7280', display: 'inline-flex', padding: 4 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h1 style={{ fontSize: 17, fontWeight: 800, color: '#111827', letterSpacing: '-0.3px' }}>내 정보</h1>
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '64px 0' }}>불러오는 중…</p>
      ) : !user ? (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: '32px 24px', textAlign: 'center', marginTop: 8 }}>
          <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>
            로그인하고 찜한 가게와 새 소식을
            <br />한곳에서 확인하세요.
          </p>
          <button
            onClick={() => setLoginOpen(true)}
            style={{ marginTop: 18, width: '100%', height: 48, borderRadius: 12, background: '#111827', color: '#fff', fontSize: 14.5, fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            로그인 / 시작하기
          </button>
          <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} reason="내 정보를 보려면 로그인하세요" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
          {/* Profile */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 44, height: 44, borderRadius: '50%', background: '#f3f4f6', color: '#6b7280', display: 'grid', placeItems: 'center', flexShrink: 0, fontWeight: 800 }}>
              {(user.email || '회')[0].toUpperCase()}
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(user.user_metadata?.name as string) || (user.user_metadata?.full_name as string) || user.email || '회원'}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                {(user.app_metadata?.provider as string) === 'kakao' ? '카카오 로그인' : 'Google 로그인'}
              </div>
            </div>
            <button onClick={logout} style={{ flexShrink: 0, fontSize: 12.5, color: '#6b7280', background: '#f8f9fa', border: '1px solid #e5e7eb', borderRadius: 8, padding: '7px 12px', cursor: 'pointer' }}>
              로그아웃
            </button>
          </div>

          {/* 알림(마케팅 수신) 동의 */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>새 소식·혜택 알림</div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, lineHeight: 1.5 }}>
                찜한 가게의 새 현황·혜택을 알림으로 받아요 (마케팅 수신 동의)
              </div>
            </div>
            <button
              onClick={toggleConsent}
              disabled={optedIn === null}
              aria-pressed={!!optedIn}
              aria-label="마케팅 수신 동의"
              style={{ flexShrink: 0, width: 46, height: 28, borderRadius: 999, border: 'none', cursor: optedIn === null ? 'default' : 'pointer', position: 'relative', background: optedIn ? '#111827' : '#d1d5db', transition: 'background .15s', opacity: optedIn === null ? 0.5 : 1 }}
            >
              <span style={{ position: 'absolute', top: 3, left: optedIn ? 21 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
            </button>
          </div>

          {/* 채팅 프로필 (닉네임·프사) */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>채팅 프로필</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2, lineHeight: 1.5 }}>
              가게 채팅에 보이는 닉네임과 프사예요. 안 바꾸면 기본 동물 캐릭터로 표시돼요.
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt=""
                  width={56}
                  height={56}
                  style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                />
              ) : (
                <span style={{ width: 56, height: 56, borderRadius: '50%', background: defaultAvatar.color, display: 'grid', placeItems: 'center', fontSize: 30, lineHeight: 1, flexShrink: 0 }}>
                  {defaultAvatar.emoji}
                </span>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, alignItems: 'flex-start' }}>
                <label
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 36, padding: '0 14px', borderRadius: 9, background: '#f3f4f6', color: '#374151', fontSize: 12.5, fontWeight: 700, border: '1px solid #e5e7eb', cursor: uploadingAvatar ? 'default' : 'pointer' }}
                >
                  {uploadingAvatar ? '업로드 중…' : '사진 올리기'}
                  <input type="file" accept="image/*" onChange={onPickAvatar} disabled={uploadingAvatar} style={{ display: 'none' }} />
                </label>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    style={{ fontSize: 12, color: '#6b7280', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    기본 동물로 되돌리기
                  </button>
                )}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 6 }}>닉네임</label>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                placeholder={defaultNick}
                style={{ width: '100%', height: 44, padding: '0 13px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, color: '#111827', outline: 'none' }}
              />
              <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 6 }}>
                비워두면 기본 닉 “{defaultNick}”으로 표시돼요.
              </div>
            </div>

            {profileErr && <p style={{ color: '#ef4444', fontSize: 12.5, marginTop: 10 }}>{profileErr}</p>}
            {profileMsg && <p style={{ color: '#16a34a', fontSize: 12.5, fontWeight: 600, marginTop: 10 }}>{profileMsg}</p>}

            <button
              onClick={saveProfile}
              disabled={savingProfile || uploadingAvatar || !profileLoaded}
              style={{ marginTop: 12, height: 42, padding: '0 18px', borderRadius: 10, background: savingProfile || uploadingAvatar ? '#9ca3af' : '#111827', color: '#fff', fontSize: 13.5, fontWeight: 700, border: 'none', cursor: savingProfile || uploadingAvatar ? 'default' : 'pointer' }}
            >
              {savingProfile ? '저장 중…' : '프로필 저장'}
            </button>
          </div>

          {/* 내 찜 */}
          <section>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', margin: '0 2px 8px' }}>
              내 찜 {favs ? `(${favs.length})` : ''}
            </h2>
            {favs === null ? (
              <p style={{ color: '#9ca3af', fontSize: 13, padding: '8px 2px' }}>불러오는 중…</p>
            ) : favs.length === 0 ? (
              <div style={{ background: '#fff', border: '1px dashed #d1d5db', borderRadius: 14, padding: '28px 20px', textAlign: 'center' }}>
                <p style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1.6 }}>
                  아직 찜한 가게가 없어요.
                  <br />지도에서 마음에 드는 가게를 찜해보세요.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {favs.map((s) => (
                  <Link
                    key={s.id}
                    href={`/spot/${s.slug}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px', textDecoration: 'none' }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 14.5, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.name}
                        </span>
                        {s.has_fresh_story && (
                          <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 700, color: '#7c3aed', background: '#ede9fe', borderRadius: 999, padding: '2px 7px' }}>
                            새 현황
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                        {getRegionLabel(s.region)} · {getCategoryLabel(s.category)}
                      </div>
                    </div>
                    <span style={{ color: '#d1d5db', flexShrink: 0 }}>›</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* 사장님 */}
          <Link
            href="/partner"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', textDecoration: 'none' }}
          >
            <span style={{ fontSize: 13.5, color: '#374151', fontWeight: 600 }}>내 가게가 있나요? · 사장님 센터</span>
            <span style={{ color: '#d1d5db' }}>›</span>
          </Link>

          {/* 계정 및 데이터 삭제 (Google Play 정책: 앱 내 삭제 경로) */}
          <Link
            href="/account-deletion"
            style={{ display: 'block', textAlign: 'center', fontSize: 12, color: '#9ca3af', textDecoration: 'underline', padding: '2px 0 6px' }}
          >
            계정 및 데이터 삭제
          </Link>
        </div>
      )}
    </div>
  );
}

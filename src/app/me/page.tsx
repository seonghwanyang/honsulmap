'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/lib/useUser';
import { createBrowserSupabase } from '@/lib/supabase/client';
import LoginModal from '@/components/LoginModal';
import { getRegionLabel, getCategoryLabel } from '@/lib/utils';

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

  useEffect(() => {
    if (!user) {
      setFavs(null);
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
    return () => {
      alive = false;
    };
  }, [user]);

  const logout = async () => {
    await createBrowserSupabase().auth.signOut();
    window.location.href = '/';
  };

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
                            새 스토리
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
        </div>
      )}
    </div>
  );
}

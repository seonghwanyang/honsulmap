'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { track } from '@/lib/analytics';
import { useBackClose } from '@/lib/useBackClose';
import { useSuppressAdBannerWhile } from '@/lib/adBanner';

interface Props {
  open: boolean;
  onClose: () => void;
  // Optional context line, e.g. the metered-gate message.
  reason?: string;
}

export default function LoginModal({ open, onClose, reason }: Props) {
  const [mounted, setMounted] = useState(false);
  const [busy, setBusy] = useState<'kakao' | 'google' | 'apple' | null>(null);
  const [err, setErr] = useState('');
  const [platform, setPlatform] = useState<'web' | 'ios' | 'android'>('web');
  useEffect(() => {
    setMounted(true);
    setPlatform(Capacitor.getPlatform() as 'web' | 'ios' | 'android');
  }, []);

  useBackClose(open, onClose);
  // 로그인 모달이 열려 있는 동안 하단 광고 배너를 숨긴다(버튼 가림 방지).
  useSuppressAdBannerWhile(open);

  if (!open || !mounted) return null;

  // 네이티브 앱은 하단 앵커(bottom sheet) 대신 중앙 정렬 — 하단 AdMob 배너는
  // 웹뷰 위에 얹히는 네이티브 뷰라, hideBanner가 기기/플러그인 사정으로 실패하면
  // 하단 시트의 로그인 버튼이 배너에 가려 안 눌린다. 중앙이면 배너 유무와 무관하게 안 겹침.
  const isNative = platform === 'ios' || platform === 'android';

  const signIn = async (provider: 'kakao' | 'google' | 'apple') => {
    if (busy) return;
    setBusy(provider);
    setErr('');
    track('login_started', { provider });
    try {
      // 네이티브 앱: 구글/애플은 웹뷰 OAuth가 막히므로 네이티브 플러그인으로.
      // (카카오는 웹뷰에서 동작하므로 아래 웹 OAuth 경로를 그대로 탄다)
      if (Capacitor.isNativePlatform() && (provider === 'google' || provider === 'apple')) {
        const { nativeSignIn } = await import('@/lib/nativeAuth');
        await nativeSignIn(provider);
        // 세션이 쿠키에 저장됨 → 리로드로 서버컴포넌트에 로그인 반영
        window.location.reload();
        return;
      }
      const supabase = createBrowserSupabase();
      const next = window.location.pathname + window.location.search;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      // On success the browser navigates away to the provider; only reach
      // here on an error (e.g. provider not configured yet).
      if (error) {
        setErr(error.message);
        setBusy(null);
      }
    } catch (e) {
      setErr((e as Error)?.message || '로그인에 실패했어요. 다시 시도해주세요.');
      setBusy(null);
    }
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[10000] flex ${isNative ? 'items-center' : 'items-end sm:items-center'} justify-center p-3`}
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white"
        style={{ borderRadius: 18, overflow: 'hidden' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-7 pb-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-192.png"
            alt="혼술맵"
            width={52}
            height={52}
            style={{ borderRadius: 13, margin: '0 auto 12px' }}
          />
          <h2 className="font-bold" style={{ color: '#111827', fontSize: 17, letterSpacing: '-0.3px' }}>
            혼술맵 로그인
          </h2>
          <p style={{ color: '#6b7280', fontSize: 12.5, marginTop: 6, lineHeight: 1.5 }}>
            {reason ?? '로그인 하고 실시간 현황을 확인하세요'}
          </p>
        </div>

        <div className="px-6 pt-3 pb-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => signIn('kakao')}
            disabled={!!busy}
            className="w-full flex items-center justify-center gap-2"
            style={{
              height: 48,
              borderRadius: 12,
              background: '#FEE500',
              color: 'rgba(0,0,0,0.85)',
              fontSize: 14.5,
              fontWeight: 700,
              border: 'none',
              cursor: busy ? 'default' : 'pointer',
              opacity: busy && busy !== 'kakao' ? 0.5 : 1,
            }}
          >
            <KakaoIcon />
            {busy === 'kakao' ? '이동 중…' : '카카오로 시작하기'}
          </button>

          <button
            type="button"
            onClick={() => signIn('google')}
            disabled={!!busy}
            className="w-full flex items-center justify-center gap-2"
            style={{
              height: 48,
              borderRadius: 12,
              background: '#fff',
              color: '#1f2937',
              fontSize: 14.5,
              fontWeight: 600,
              border: '1px solid #e5e7eb',
              cursor: busy ? 'default' : 'pointer',
              opacity: busy && busy !== 'google' ? 0.5 : 1,
            }}
          >
            <GoogleIcon />
            {busy === 'google' ? '이동 중…' : 'Google로 시작하기'}
          </button>

          {/* 애플 로그인: iOS 네이티브에서만 (App Store 4.8 필수). 네이티브 SIWA. */}
          {platform === 'ios' && (
            <button
              type="button"
              onClick={() => signIn('apple')}
              disabled={!!busy}
              className="w-full flex items-center justify-center gap-2"
              style={{
                height: 48,
                borderRadius: 12,
                background: '#000',
                color: '#fff',
                fontSize: 14.5,
                fontWeight: 600,
                border: 'none',
                cursor: busy ? 'default' : 'pointer',
                opacity: busy && busy !== 'apple' ? 0.5 : 1,
              }}
            >
              <AppleIcon />
              {busy === 'apple' ? '진행 중…' : 'Apple로 계속하기'}
            </button>
          )}

          {err && (
            <p style={{ color: '#ef4444', fontSize: 12, textAlign: 'center', marginTop: 2, lineHeight: 1.5 }}>
              {err}
            </p>
          )}
          <p style={{ color: '#9ca3af', fontSize: 11, textAlign: 'center', marginTop: 6, lineHeight: 1.5 }}>
            로그인 시{' '}
            <a href="/terms" className="underline">이용약관</a> ·{' '}
            <a href="/privacy" className="underline">개인정보처리방침</a>에 동의합니다.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3C6.99 3 3 6.13 3 9.99c0 2.5 1.66 4.69 4.15 5.93-.18.66-.66 2.4-.76 2.77-.12.46.17.45.36.33.15-.1 2.37-1.6 3.33-2.25.56.08 1.13.12 1.72.12 5.01 0 9-3.13 9-6.99C24 6.13 17.01 3 12 3z"
        fill="rgba(0,0,0,0.85)"
        transform="translate(-1.5 0)"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function AppleIcon() {
  // 공식 Apple 로고(정확한 비율, viewBox 384x512) — HIG 준수용.
  return (
    <svg width="15" height="18" viewBox="0 0 384 512" fill="#fff" aria-hidden="true">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
    </svg>
  );
}

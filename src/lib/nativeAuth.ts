'use client';

// 네이티브(Capacitor) 앱에서 구글/애플 로그인을 '네이티브 시트'로 처리한다.
// 이유: 구글은 임베디드 웹뷰 OAuth를 차단(disallowed_useragent)하고, 애플은
// iOS에서 네이티브 Sign in with Apple이 필수/권장이라서. 카카오는 웹뷰에서
// 되므로 여기서 다루지 않는다(LoginModal이 웹 OAuth로 처리).
//
// 흐름: @capgo/capacitor-social-login 으로 네이티브 인증 → idToken 획득 →
// supabase.auth.signInWithIdToken(). 세션은 @supabase/ssr 쿠키에 저장되어
// 서버컴포넌트(피드 등)가 리로드 후 로그인 상태를 인식한다.
//
// 사전조건(미설정 시 google init 실패): 환경변수 + 대시보드 설정 필요.
//   NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID  (Google Cloud Web 클라이언트)
//   NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID  (Google Cloud iOS 클라이언트)
// 그리고 Supabase Google/Apple provider에 client ID 등록.

import { createBrowserSupabase } from '@/lib/supabase/client';

// 구글 OAuth 클라이언트 ID는 '비밀'이 아니라 공개 식별자라 코드에 박아도 안전
// (시크릿은 네이티브 플로우에서 안 씀). env로 덮어쓸 수도 있게 fallback.
const GOOGLE_WEB_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ??
  '886249200062-jer1h6rbqj3i9f7a4b4obr56cjlcghoo.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID ??
  '886249200062-uu5krad7fu6pqkrgfhabcnm4421nhv0b.apps.googleusercontent.com';

let initialized = false;

// @capgo 플러그인은 네이티브에서만 의미가 있으므로 동적 import (웹 번들 영향 X).
async function getSocialLogin() {
  const mod = await import('@capgo/capacitor-social-login');
  return mod.SocialLogin;
}

async function ensureInit() {
  if (initialized) return;
  const { Capacitor } = await import('@capacitor/core');
  const SocialLogin = await getSocialLogin();
  await SocialLogin.initialize({
    google: {
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iOSClientId: GOOGLE_IOS_CLIENT_ID,
      mode: 'online',
    },
    // 애플은 iOS에서만 init. Android는 apple.android.redirectUrl을 요구해서
    // 빈 객체를 넘기면 initialize 자체가 실패한다(구글까지 막힘).
    ...(Capacitor.getPlatform() === 'ios' ? { apple: {} } : {}),
  });
  initialized = true;
}

// rawNonce(평문) + nonceDigest(SHA-256). 구글엔 digest를, Supabase엔 raw를 전달.
async function getNonce() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = (arr: Uint8Array) =>
    Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  const rawNonce = hex(bytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawNonce));
  return { rawNonce, nonceDigest: hex(new Uint8Array(digest)) };
}

export async function nativeSignIn(provider: 'google' | 'apple'): Promise<void> {
  await ensureInit();
  const SocialLogin = await getSocialLogin();
  const supabase = createBrowserSupabase();

  if (provider === 'google') {
    const { rawNonce, nonceDigest } = await getNonce();
    const res = await SocialLogin.login({
      provider: 'google',
      options: { scopes: ['email', 'profile'], nonce: nonceDigest },
    });
    const idToken = (res.result as { idToken?: string }).idToken;
    if (!idToken) throw new Error('Google idToken 없음');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
      nonce: rawNonce,
    });
    if (error) throw error;
  } else {
    const res = await SocialLogin.login({ provider: 'apple', options: {} });
    const idToken = (res.result as { idToken?: string }).idToken;
    if (!idToken) throw new Error('Apple idToken 없음');
    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: idToken,
    });
    if (error) throw error;
  }
}

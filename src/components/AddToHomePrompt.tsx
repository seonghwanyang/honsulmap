'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const DISMISS_KEY = 'honsulmap_a2hs_dismissed';
const INSTALLED_KEY = 'honsulmap_pwa_installed';
const WELCOME_KEY = 'honsulmap_welcome_seen';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// Floating "홈 화면에 추가" card. Shows on the map only, and only AFTER the
// onboarding sequence: WelcomeModal (location step, which blurs the map) is
// closed → blur lifts → clean map → a beat later this nudge appears. Never
// piles on top of the welcome/location step.
//
// Install-state detection so it doesn't nag people who already added it:
//  - running standalone (launched from home screen) → remember + never show
//  - Android: only when beforeinstallprompt fires (browser suppresses it
//    once installed); we capture the event early but defer the UI until the
//    welcome step is done
//  - iOS Safari: no prompt API → manual hint; a sticky dismiss flag covers
//    the "already added but browsing" case iOS can't report
export default function AddToHomePrompt() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<'android' | 'ios' | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // The nudge belongs to the map onboarding, not the feed/community tabs.
    if (pathname !== '/') return;
    if (isStandalone()) {
      try {
        localStorage.setItem(INSTALLED_KEY, '1');
      } catch {
        // ignore
      }
      return;
    }
    try {
      if (localStorage.getItem(DISMISS_KEY) || localStorage.getItem(INSTALLED_KEY)) {
        return;
      }
    } catch {
      return;
    }

    const ua = navigator.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);

    let captured: BeforeInstallPromptEvent | null = null;
    let ready = false; // welcome closed (blur off) → ok to show
    let shown = false;
    let iosTimer: ReturnType<typeof setTimeout> | undefined;
    let revealTimer: ReturnType<typeof setTimeout> | undefined;

    const maybeShow = () => {
      if (shown || !ready) return;
      if (captured) {
        shown = true;
        setDeferred(captured);
        setPlatform('android');
        setVisible(true);
      } else if (isIOS && isSafari) {
        // Let the map settle after the blur lifts, then hint.
        iosTimer = setTimeout(() => {
          if (shown) return;
          shown = true;
          setPlatform('ios');
          setVisible(true);
        }, 1200);
      }
      // Android with no captured prompt yet → wait for beforeinstallprompt.
    };

    const onBIP = (e: Event) => {
      e.preventDefault();
      captured = e as BeforeInstallPromptEvent;
      maybeShow();
    };
    const onInstalled = () => {
      try {
        localStorage.setItem(INSTALLED_KEY, '1');
      } catch {
        // ignore
      }
      setVisible(false);
    };
    const onWelcomeClosed = () => {
      ready = true;
      revealTimer = setTimeout(maybeShow, 1000);
    };

    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('honsulmap:welcome-closed', onWelcomeClosed);

    // Return visitor (welcome already seen) → no modal will fire the event,
    // so arm it ourselves after a beat for the map to paint.
    try {
      if (localStorage.getItem(WELCOME_KEY)) {
        ready = true;
        revealTimer = setTimeout(maybeShow, 1200);
      }
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('honsulmap:welcome-closed', onWelcomeClosed);
      if (iosTimer) clearTimeout(iosTimer);
      if (revealTimer) clearTimeout(revealTimer);
    };
  }, [pathname]);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore — hidden for this session regardless
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      // ignore
    }
    setVisible(false);
    setDeferred(null);
  };

  if (!visible || !platform) return null;

  return (
    <div
      role="region"
      aria-label="홈 화면에 추가"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)',
        zIndex: 9990,
        maxWidth: 440,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        boxShadow: '0 6px 24px rgba(0,0,0,0.13)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icon-192.png"
        alt="혼술맵"
        width={40}
        height={40}
        style={{ borderRadius: 10, flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#111827',
            letterSpacing: '-0.2px',
            lineHeight: 1.35,
          }}
        >
          홈 화면에 추가해서 앱처럼 열어요
        </div>
        {platform === 'ios' && (
          <div
            style={{
              fontSize: 11.5,
              color: '#6b7280',
              marginTop: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flexWrap: 'wrap',
            }}
          >
            <span>공유</span>
            <ShareIcon />
            <span>→ &lsquo;홈 화면에 추가&rsquo;</span>
          </div>
        )}
      </div>

      {platform === 'android' && (
        <button
          type="button"
          onClick={install}
          style={{
            flexShrink: 0,
            background: '#111827',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            padding: '8px 16px',
            borderRadius: 999,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          설치
        </button>
      )}

      <button
        type="button"
        onClick={dismiss}
        aria-label="닫기"
        style={{
          flexShrink: 0,
          color: '#9ca3af',
          padding: 4,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#ea573e"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="m8 7 4-4 4 4" />
      <path d="M4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/useUser';

// 첫 로그인 후 1회 노출되는 마케팅 수신 동의 인터스티셜.
// 노출 조건: 로그인 ∧ 아직 동의 안 함(API) ∧ 이 기기에서 아직 안 봄(localStorage).
// "나중에"/바깥 탭 = 스킵(영구 거부 아님 — 찜 시점 등에서 다시 권유 가능).
const SEEN_KEY = 'mkt_interstitial_seen';

export default function MarketingConsentPrompt() {
  const { user } = useUser();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      return;
    }
    let alive = true;
    fetch('/api/me/marketing-consent')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && !d.opted_in) setShow(true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user]);

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch('/api/me/marketing-consent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opted_in: true, source: 'interstitial' }),
      });
    } catch {
      /* best-effort */
    }
    setBusy(false);
    close();
  };

  if (!show) return null;

  return (
    <div
      onClick={close}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 360,
          background: '#fff',
          borderRadius: 20,
          padding: '26px 22px 22px',
        }}
      >
        <div style={{ fontSize: 32, textAlign: 'center', marginBottom: 10 }}>🔔</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', textAlign: 'center', letterSpacing: '-0.3px' }}>
          새 소식·혜택, 알림으로 받아보세요
        </h2>
        <p style={{ fontSize: 13.5, color: '#6b7280', textAlign: 'center', lineHeight: 1.6, marginTop: 8 }}>
          찜한 가게의 새 스토리와 사장님 혜택을
          <br />
          가장 먼저 알려드려요.
        </p>
        <button
          onClick={accept}
          disabled={busy}
          style={{ marginTop: 18, width: '100%', height: 50, borderRadius: 12, background: '#111827', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
        >
          알림 받기
        </button>
        <button
          onClick={close}
          style={{ marginTop: 8, width: '100%', height: 42, borderRadius: 12, background: 'transparent', color: '#9ca3af', fontSize: 13.5, fontWeight: 600, border: 'none', cursor: 'pointer' }}
        >
          나중에
        </button>
        <p style={{ fontSize: 11, color: '#b0b4bb', textAlign: 'center', marginTop: 10, lineHeight: 1.5 }}>
          마케팅 정보 수신(선택)에 동의합니다. [내 정보]에서 언제든 해제할 수 있어요.
        </p>
      </div>
    </div>
  );
}

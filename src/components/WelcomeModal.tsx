'use client';

import { useEffect, useState } from 'react';

interface Props {
  onFindNearby: () => void;
  onReportSpot: () => void;
}

// Onboarding modal — first visit only, then permanent dismiss. Closes
// from any path (backdrop, CTA, explicit button) all persist. Users
// who want to see the intro again can hit /about from the footer.
const SEEN_KEY = 'honsulmap_welcome_seen';

export default function WelcomeModal({ onFindNearby, onReportSpot }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  const close = () => {
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      // localStorage blocked (private mode etc.) — still close.
    }
    // Tell the home-screen prompt the location/intro step is done and the
    // un-blurred map is now showing, so it can nudge afterward (not on top
    // of this modal).
    try {
      window.dispatchEvent(new CustomEvent('honsulmap:welcome-closed'));
    } catch {
      // ignore
    }
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={close}
    >
      <div
        className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-sm shadow-2xl"
        style={{ maxHeight: 'calc(100dvh - 2rem)', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Logo */}
        <div
          className="relative mx-auto mb-3"
          style={{ width: 96, height: 96 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon.png"
            alt="혼술맵"
            className="w-full h-full object-contain"
            style={{ borderRadius: 22 }}
          />
        </div>

        <p className="text-center text-sm mb-6" style={{ color: '#6b7280' }}>
          전국 혼술바·파티·게스트하우스 실시간 현황 지도
        </p>

        {/* Feature bullets */}
        <div className="flex flex-col gap-3 mb-6">
          <Feature icon={<ZapIcon />}>
            실시간 현황으로 가게 분위기 확인
          </Feature>
          <Feature icon={<CupIcon />}>
            혼술바 + 게스트하우스 한곳에서
          </Feature>
          <Feature icon={<MessageIcon />}>
            사용자 제보로 함께 만드는 지도
          </Feature>
        </div>

        {/* Primary + Secondary CTAs */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              onFindNearby();
              close();
            }}
            className="w-full py-3.5 font-bold text-[15px] rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            style={{ background: '#111827', color: '#fff' }}
          >
            <MapPinIcon />
            내 근처 가게 찾기
          </button>
          <button
            onClick={() => {
              onReportSpot();
              close();
            }}
            className="w-full py-3.5 font-bold text-[15px] rounded-2xl flex items-center justify-center gap-2 transition-colors"
            style={{
              background: '#fff',
              color: '#111827',
              border: '1.5px solid #e5e7eb',
            }}
          >
            <PlusIcon />
            가게 제보하기
          </button>
        </div>

        <p
          className="text-xs text-center mt-4"
          style={{ color: '#9ca3af', lineHeight: 1.5 }}
        >
          실시간 현황 + 사용자 제보 기반 · 방문 전 확인을 권장해요
        </p>

        <a
          href="https://www.instagram.com/honsulmap"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 mt-3 mx-auto px-4 py-2.5 rounded-2xl active:bg-gray-200 transition-colors"
          style={{ background: '#f3f4f6' }}
        >
          <InstagramIcon />
          <span className="text-sm font-bold" style={{ color: '#111827' }}>
            @honsulmap
          </span>
          <span className="text-xs" style={{ color: '#6b7280' }}>
            정보 수정·문의
          </span>
        </a>

        <p
          className="text-xs text-center mt-2"
          style={{ color: '#9ca3af' }}
        >
          <a href="/terms" className="underline underline-offset-2">
            이용약관
          </a>
          {' · '}
          <a href="/about" className="underline underline-offset-2">
            개인정보처리방침
          </a>
        </p>
      </div>
    </div>
  );
}

function Feature({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: '#f3f4f6', color: '#111827' }}
      >
        {icon}
      </div>
      <span className="text-sm font-medium" style={{ color: '#374151' }}>
        {children}
      </span>
    </div>
  );
}

// Lucide-style line icons inlined to avoid a new dep. All paths sourced
// from lucide.dev — zap / wine glass / message-square / map-pin / plus.

const SVG_BASE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function ZapIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" {...SVG_BASE}>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function CupIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" {...SVG_BASE}>
      <path d="M8 2h8l-2 10h-4L8 2z" />
      <path d="M12 12v6" />
      <path d="M9 18h6" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" {...SVG_BASE}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" {...SVG_BASE}>
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx={12} cy={10} r={3} />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" {...SVG_BASE}>
      <line x1={12} y1={5} x2={12} y2={19} />
      <line x1={5} y1={12} x2={19} y2={12} />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none">
      <rect x={2} y={2} width={20} height={20} rx={6} stroke="#111827" strokeWidth={2} />
      <circle cx={12} cy={12} r={5} stroke="#111827" strokeWidth={2} />
      <circle cx={17.5} cy={6.5} r={1.5} fill="#111827" />
    </svg>
  );
}

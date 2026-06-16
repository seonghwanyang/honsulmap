// Shared presentational primitives for the 사장님 센터 (owner portal).
// Pure presentation — no data fetching, no business logic. Keeps the card /
// chip / header / button look consistent across the dashboard + claim pages so
// the dashboard feels like one designed surface rather than three.
//
// Palette follows the app design system (globals.css): #111827 text,
// #6b7280 secondary, #9ca3af muted, #e5e7eb borders, #f8f9fa/#f3f4f6 surfaces.
// ACCENT for the business context is a deep indigo (#2563eb / #eff6ff), used
// sparingly for the primary brand mark and the "active" nav state.

import type { CSSProperties, ReactNode } from 'react';

export const ACCENT = '#2563eb';
export const ACCENT_DARK = '#1d4ed8';
export const ACCENT_SOFT = '#eff6ff';

// ---- Card --------------------------------------------------------------

export function Card({
  children,
  dashed = false,
  style,
  className,
}: {
  children: ReactNode;
  dashed?: boolean;
  style?: CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: '#fff',
        border: dashed ? '1px dashed #d1d5db' : '1px solid #e5e7eb',
        borderRadius: 16,
        boxShadow: dashed ? 'none' : '0 1px 2px rgba(17, 24, 39, 0.04)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ---- Chip (role / VIP / status pills) ---------------------------------

type ChipTone = 'neutral' | 'vip' | 'pending' | 'accent';

const CHIP_TONES: Record<ChipTone, CSSProperties> = {
  neutral: { color: '#374151', background: '#f3f4f6' },
  vip: { color: '#92400e', background: '#fef3c7' },
  pending: { color: '#a16207', background: '#fef9c3' },
  accent: { color: ACCENT_DARK, background: ACCENT_SOFT },
};

export function Chip({ children, tone = 'neutral' }: { children: ReactNode; tone?: ChipTone }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '-0.2px',
        borderRadius: 7,
        padding: '3px 8px',
        lineHeight: 1.2,
        ...CHIP_TONES[tone],
      }}
    >
      {children}
    </span>
  );
}

// ---- Page header (title + optional subtitle + right-aligned action) ----

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: '#111827',
            letterSpacing: '-0.5px',
            lineHeight: 1.25,
          }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ color: '#6b7280', fontSize: 13.5, marginTop: 6, lineHeight: 1.6, maxWidth: 560 }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

// ---- Buttons -----------------------------------------------------------

const BTN_BASE: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  height: 44,
  padding: '0 20px',
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: '-0.2px',
  border: '1px solid transparent',
  textDecoration: 'none',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'opacity 0.15s ease, background 0.15s ease',
};

export function buttonStyle(
  variant: 'primary' | 'outline' = 'primary',
  opts: { disabled?: boolean; fullWidth?: boolean } = {},
): CSSProperties {
  const { disabled, fullWidth } = opts;
  const variants: Record<string, CSSProperties> = {
    primary: { background: '#111827', color: '#fff' },
    outline: { background: '#fff', color: '#374151', borderColor: '#e5e7eb' },
  };
  return {
    ...BTN_BASE,
    ...variants[variant],
    width: fullWidth ? '100%' : undefined,
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'default' : 'pointer',
  };
}

// ---- Icons (inline SVG, currentColor) ---------------------------------

type IconProps = { size?: number };

export function GridIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function StoreIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9l1.5-5h15L21 9" />
      <path d="M4 9v11h16V9" />
      <path d="M3 9a2.4 2.4 0 0 0 4.5 0 2.4 2.4 0 0 0 4.5 0 2.4 2.4 0 0 0 4.5 0A2.4 2.4 0 0 0 21 9" />
      <path d="M9 20v-5h6v5" />
    </svg>
  );
}

export function ChartIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 3v18h18" />
      <rect x="7" y="12" width="3" height="6" rx="0.5" />
      <rect x="12.5" y="8" width="3" height="10" rx="0.5" />
      <rect x="18" y="5" width="3" height="13" rx="0.5" />
    </svg>
  );
}

export function MegaphoneIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z" />
      <path d="M15 8a4 4 0 0 1 0 8" />
      <path d="M18.5 5a8 8 0 0 1 0 14" />
    </svg>
  );
}

export function PlusIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function SearchIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

export function CheckIcon({ size = 28 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 13 4 4L19 7" />
    </svg>
  );
}

export function LogoutIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

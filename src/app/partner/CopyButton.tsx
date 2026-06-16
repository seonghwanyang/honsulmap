'use client';

import { useState } from 'react';

// One-tap copy for the owner's DM verification code (the code is their key
// action item — they paste it into a DM to @honsulmap). Fails silently if the
// clipboard API is blocked; the code stays selectable either way.
export function CopyButton({ text, style }: { text: string; style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked (insecure context) — selection still works */
        }
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '-0.2px',
        lineHeight: 1.2,
        color: copied ? '#15803d' : '#374151',
        background: copied ? '#dcfce7' : '#fff',
        border: `1px solid ${copied ? '#bbf7d0' : '#e5e7eb'}`,
        borderRadius: 7,
        padding: '4px 9px',
        cursor: 'pointer',
        transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
        ...style,
      }}
    >
      {copied ? '복사됨 ✓' : '복사'}
    </button>
  );
}

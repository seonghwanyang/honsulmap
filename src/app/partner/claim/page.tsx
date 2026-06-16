'use client';

import { useState } from 'react';
import Link from 'next/link';
import AuthGate from '../AuthGate';
import {
  ACCENT,
  ACCENT_DARK,
  ACCENT_SOFT,
  Card,
  PageHeader,
  buttonStyle,
  SearchIcon,
  CheckIcon,
} from '../ui';

interface SpotHit {
  id: string;
  name: string;
  slug: string;
  region: string;
  instagram_id: string | null;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 48,
  padding: '0 16px',
  borderRadius: 12,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#111827',
  fontSize: 14.5,
  outline: 'none',
};

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
      <span
        aria-hidden="true"
        style={{ flexShrink: 0, width: 20, height: 20, borderRadius: '50%', background: '#111827', color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center' }}
      >
        {n}
      </span>
      <span style={{ paddingTop: 1 }}>{children}</span>
    </li>
  );
}

function ClaimContent() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SpotHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SpotHit | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [code, setCode] = useState('');

  const search = async () => {
    if (q.trim().length < 2 || searching) return;
    setSearching(true);
    setError('');
    try {
      const res = await fetch(`/api/partner/spot-search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      setResults(data.spots ?? []);
      setSearched(true);
    } catch {
      setError('검색에 실패했어요. 다시 시도해주세요.');
    } finally {
      setSearching(false);
    }
  };

  const submit = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/partner/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spot_id: selected.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || '신청에 실패했어요.');
      setCode(body.code ?? '');
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
        <Card style={{ width: '100%', maxWidth: 460, padding: '34px 26px', textAlign: 'center' }}>
          <span
            aria-hidden="true"
            style={{ width: 56, height: 56, margin: '0 auto', borderRadius: 16, background: '#dcfce7', color: '#15803d', display: 'grid', placeItems: 'center' }}
          >
            <CheckIcon size={28} />
          </span>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', marginTop: 16, letterSpacing: '-0.4px' }}>
            거의 다 됐어요!
          </h1>
          <p style={{ color: '#6b7280', fontSize: 13.5, marginTop: 8, lineHeight: 1.6 }}>
            <b style={{ color: '#111827' }}>{selected?.name}</b> 소유권 확인을 위해
            <br />
            아래 인증 코드를 DM으로 보내주세요.
          </p>

          <div
            style={{ margin: '18px 0', padding: 16, background: ACCENT_SOFT, border: '1px solid #dbeafe', borderRadius: 14 }}
          >
            <div style={{ fontSize: 11, color: ACCENT_DARK, fontWeight: 700, letterSpacing: '0.3px' }}>인증 코드</div>
            <div
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 26, fontWeight: 800, color: '#111827', letterSpacing: '2px', marginTop: 4 }}
            >
              {code || '—'}
            </div>
          </div>

          <ol style={{ textAlign: 'left', margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
            <Step n={1}>
              <b style={{ color: '#111827' }}>
                가게 인스타 계정{selected?.instagram_id ? ` (@${selected.instagram_id})` : ''}
              </b>
              으로 로그인
            </Step>
            <Step n={2}>
              <b style={{ color: '#111827' }}>@honsulmap</b> 으로 DM 열기
            </Step>
            <Step n={3}>
              위 <b style={{ color: '#111827' }}>인증 코드</b>를 그대로 전송
            </Step>
          </ol>

          <p
            style={{ fontSize: 12, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 12px', marginTop: 14, lineHeight: 1.5, textAlign: 'left' }}
          >
            ⚠️ 반드시 <b>가게 인스타 계정</b>으로 보내야 확인돼요. (개인 계정 ❌)
          </p>

          <a
            href="https://ig.me/m/honsulmap"
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...buttonStyle('primary'), marginTop: 16, width: '100%' }}
          >
            @honsulmap에 DM 보내기
          </a>
          <Link href="/partner/dashboard" style={{ ...buttonStyle('outline'), marginTop: 8, width: '100%' }}>
            대시보드로 (코드는 여기서 다시 볼 수 있어요)
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <PageHeader
        title="내 가게 등록"
        subtitle="혼술맵에 등록된 내 가게를 찾아 소유권을 신청하세요. 운영자 확인 후 직접 관리할 수 있어요."
      />

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Step 1 — search */}
          <Card style={{ padding: 18 }}>
            <label
              style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: ACCENT_DARK, letterSpacing: '-0.2px', marginBottom: 10 }}
            >
              <span style={{ width: 18, height: 18, borderRadius: 6, background: ACCENT_SOFT, color: ACCENT, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>
                1
              </span>
              가게 찾기
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'inline-flex' }}>
                  <SearchIcon size={17} />
                </span>
                <input
                  style={{ ...inputStyle, paddingLeft: 40 }}
                  placeholder="가게 이름 또는 인스타 아이디"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && search()}
                />
              </div>
              <button
                onClick={search}
                disabled={searching || q.trim().length < 2}
                style={{
                  flexShrink: 0,
                  height: 48,
                  padding: '0 22px',
                  borderRadius: 12,
                  background: ACCENT,
                  color: '#fff',
                  fontSize: 14.5,
                  fontWeight: 700,
                  letterSpacing: '-0.2px',
                  border: 'none',
                  cursor: searching || q.trim().length < 2 ? 'default' : 'pointer',
                  opacity: searching || q.trim().length < 2 ? 0.5 : 1,
                }}
              >
                {searching ? '검색…' : '검색'}
              </button>
            </div>

            {searched && results.length === 0 && (
              <div style={{ marginTop: 14, padding: '18px 14px', background: '#f8f9fa', borderRadius: 12, textAlign: 'center' }}>
                <p style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.6 }}>
                  일치하는 가게가 없어요.
                  <br />
                  혼술맵에 아직 없는 가게라면 먼저 제보가 필요해요.
                </p>
              </div>
            )}

            {results.length > 0 && (
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {results.map((s) => {
                  const sel = selected?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setSelected(sel ? null : s)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        textAlign: 'left',
                        width: '100%',
                        background: sel ? ACCENT_SOFT : '#fff',
                        border: sel ? `1.5px solid ${ACCENT}` : '1px solid #e5e7eb',
                        borderRadius: 12,
                        padding: '12px 14px',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s ease, background 0.15s ease',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14.5, color: '#111827', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.name}
                        </div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                          {s.region}
                          {s.instagram_id ? ` · @${s.instagram_id}` : ''}
                        </div>
                      </div>
                      <span
                        aria-hidden="true"
                        style={{
                          flexShrink: 0,
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          border: sel ? `6px solid ${ACCENT}` : '2px solid #d1d5db',
                          background: '#fff',
                          transition: 'border 0.15s ease',
                        }}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Step 2 — confirm + submit (issues the DM code) */}
          {selected && (
            <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label
                style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: ACCENT_DARK, letterSpacing: '-0.2px' }}
              >
                <span style={{ width: 18, height: 18, borderRadius: 6, background: ACCENT_SOFT, color: ACCENT, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800 }}>
                  2
                </span>
                소유권 확인
              </label>
              <p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.6 }}>
                <b style={{ color: '#111827' }}>{selected.name}</b> 의 사장님이신가요? 신청하면 <b>인증 코드</b>를 드려요. 그 코드를 <b>가게 인스타 계정</b>으로 <b>@honsulmap</b>에 DM 보내시면, 확인 후 승인해드려요.
              </p>
              {error && (
                <p style={{ color: '#dc2626', fontSize: 12.5, background: '#fee2e2', borderRadius: 8, padding: '8px 12px' }}>
                  {error}
                </p>
              )}
              <button
                onClick={submit}
                disabled={submitting}
                style={{
                  height: 50,
                  borderRadius: 13,
                  background: ACCENT,
                  color: '#fff',
                  fontSize: 15,
                  fontWeight: 700,
                  letterSpacing: '-0.2px',
                  border: 'none',
                  cursor: submitting ? 'default' : 'pointer',
                  opacity: submitting ? 0.6 : 1,
                  boxShadow: submitting ? 'none' : `0 4px 14px ${ACCENT}33`,
                }}
              >
                {submitting ? '신청 중…' : '신청하고 인증 코드 받기'}
              </button>
            </Card>
          )}

          {error && !selected && (
            <p style={{ color: '#dc2626', fontSize: 12.5, background: '#fee2e2', borderRadius: 8, padding: '8px 12px' }}>
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClaimPage() {
  return (
    <AuthGate>
      <ClaimContent />
    </AuthGate>
  );
}

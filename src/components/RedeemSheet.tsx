'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// 혜택 리딤 시트 (playbook §1.1) — [사용하기] 탭 → GPS 확인 → 기록 → 직원 제시 화면.
// 제시 화면은 실시간 시계 + 카운트다운 + 움직이는 배경으로 스크린샷 재사용을 막는다.
// GPS 실패/원거리 시 사장 PIN(설정된 가게만)으로 우회 — 가게측 최종 승인 경로.

interface Props {
  open: boolean;
  onClose: () => void;
  spotSlug: string;
  spotName: string;
  benefitTitle: string;
  benefitDetail?: string | null;
}

type Phase = 'locating' | 'pin' | 'done' | 'error';

const SHOW_SECONDS = 180; // 제시 화면 유지 시간

function getPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  });
}

export default function RedeemSheet({ open, onClose, spotSlug, spotName, benefitTitle, benefitDetail }: Props) {
  const [phase, setPhase] = useState<Phase>('locating');
  const [err, setErr] = useState('');
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [redeemedAt, setRedeemedAt] = useState<Date | null>(null);
  const [remain, setRemain] = useState(SHOW_SECONDS);
  // 이미 사용/혜택 없음 등 PIN으로도 해결 안 되는 에러면 PIN 버튼을 감춘다.
  const [canPin, setCanPin] = useState(true);
  const startedRef = useRef(false);
  // GPS 좌표 보관 — PIN 제출에도 동봉해 거리 기록(어트리뷰션)을 남긴다.
  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);

  const submit = useCallback(
    async (payload: { lat?: number; lng?: number; pin?: string }) => {
      setSubmitting(true);
      setErr('');
      try {
        const res = await fetch(`/api/spots/${spotSlug}/redeem`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          setRedeemedAt(new Date(data.redeemed_at));
          setRemain(SHOW_SECONDS);
          setPhase('done');
          return;
        }
        if (data.pin_required) {
          // PIN 필수 가게(제품 결정) — 에러가 아니라 '직원 승인' 다음 단계.
          setErr('');
          setPhase('pin');
          return;
        }
        setErr(data.error ?? '사용 처리에 실패했어요.');
        if (payload.pin) {
          // PIN 오입력 — 재입력할 수 있게 PIN 화면 유지.
          setPhase('pin');
          return;
        }
        setCanPin(data.code !== 'already_redeemed' && data.code !== 'no_benefit');
        setPhase('error');
      } catch {
        setErr('사용 처리에 실패했어요.');
        setPhase('error');
      } finally {
        setSubmitting(false);
      }
    },
    [spotSlug],
  );

  // 열릴 때: 위치 잡고 바로 시도.
  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      setPhase('locating');
      setErr('');
      setPin('');
      setCanPin(true);
      setRedeemedAt(null);
      coordsRef.current = null;
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    void (async () => {
      const pos = await getPosition();
      coordsRef.current = pos;
      // 위치 실패여도 빈 바디로 보냄 — PIN 필수 가게는 서버가 pin_required로
      // 직원 승인 단계로 보내고, PIN 없는 가게는 안내 문구로 분기된다.
      void submit(pos ?? {});
    })();
  }, [open, submit]);

  // 제시 화면: 닫히기까지 카운트다운(1초마다 갱신 — 스크린샷 방지 겸용).
  useEffect(() => {
    if (phase !== 'done') return;
    const t = setInterval(() => {
      setRemain((r) => {
        if (r <= 1) {
          clearInterval(t);
          onClose();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [phase, onClose]);

  if (!open) return null;

  const hhmmss = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={phase === 'done' ? undefined : onClose}
    >
      {/* 제시 화면 배경 애니메이션 keyframes */}
      <style>{`@keyframes redeemFlow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`}</style>

      <div
        className="w-full max-w-sm"
        style={{ borderRadius: 18, overflow: 'hidden', margin: '0 14px 18px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {phase === 'done' ? (
          // ===== 직원 제시 화면 =====
          <div
            style={{
              background: 'linear-gradient(120deg, #ea580c, #f59e0b, #ea580c)',
              backgroundSize: '250% 250%',
              animation: 'redeemFlow 4s ease infinite',
              padding: '28px 22px 22px',
              textAlign: 'center',
              color: '#fff',
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 1, opacity: 0.95 }}>혼술맵 혜택 사용</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 12, opacity: 0.95 }}>{spotName}</div>
            <div style={{ fontSize: 24, fontWeight: 900, lineHeight: 1.3, marginTop: 6, wordBreak: 'keep-all' }}>
              {benefitTitle}
            </div>
            {benefitDetail && (
              <div style={{ fontSize: 13, marginTop: 6, opacity: 0.9, lineHeight: 1.5 }}>{benefitDetail}</div>
            )}

            <div
              style={{ margin: '18px auto 0', background: 'rgba(255,255,255,0.16)', borderRadius: 14, padding: '14px 16px', backdropFilter: 'blur(2px)' }}
            >
              <div style={{ fontSize: 12, opacity: 0.9 }}>
                ✓ 사용 처리 완료 · {redeemedAt ? hhmmss(redeemedAt) : ''}
              </div>
              <div style={{ fontSize: 34, fontWeight: 900, fontVariantNumeric: 'tabular-nums', letterSpacing: 1, marginTop: 4 }}>
                {mmss(remain)}
              </div>
              <div style={{ fontSize: 11.5, opacity: 0.85, marginTop: 2 }}>후에 화면이 닫혀요</div>
            </div>

            <div style={{ fontSize: 14, fontWeight: 800, marginTop: 16 }}>직원에게 이 화면을 보여주세요</div>

            <button
              type="button"
              onClick={onClose}
              style={{ marginTop: 16, width: '100%', height: 44, borderRadius: 12, background: 'rgba(17,24,39,0.85)', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer' }}
            >
              확인 완료 · 닫기
            </button>
          </div>
        ) : (
          // ===== 진행/오류/PIN 화면 =====
          <div style={{ background: '#fff', padding: '22px 20px 20px' }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: '#111827' }}>혜택 사용하기</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 3, lineHeight: 1.5 }}>
              {spotName} · {benefitTitle}
            </div>

            {phase === 'locating' && (
              <div style={{ padding: '26px 0 10px', textAlign: 'center' }}>
                <div style={{ fontSize: 13.5, color: '#374151', fontWeight: 600 }}>
                  {submitting ? '사용 처리 중…' : '가게 확인을 위해 위치를 확인하고 있어요…'}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>매장에서만 열 수 있어요</div>
                {/* GPS 대기 없이 바로 PIN 경로로 — 위치 프롬프트 무시/거부해도 안 막힘 */}
                <button
                  type="button"
                  onClick={() => setPhase('pin')}
                  style={{ marginTop: 14, fontSize: 12.5, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', border: 'none', borderRadius: 9, padding: '9px 14px', cursor: 'pointer' }}
                >
                  가게 PIN으로 입력할게요
                </button>
              </div>
            )}

            {phase === 'pin' && (
              <div style={{ marginTop: 14 }}>
                {err && <p style={{ fontSize: 12.5, color: '#dc2626', marginBottom: 10, lineHeight: 1.5 }}>{err}</p>}
                <div style={{ background: '#f8f9fa', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>직원에게 화면을 건네주세요</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>가게 PIN 4자리를 입력하면 사용 처리돼요.</div>
                  <input
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    inputMode="numeric"
                    placeholder="● ● ● ●"
                    style={{ marginTop: 10, width: '100%', height: 48, textAlign: 'center', fontSize: 22, fontWeight: 800, letterSpacing: 10, border: '1px solid #e5e7eb', borderRadius: 10, outline: 'none' }}
                  />
                  <button
                    type="button"
                    disabled={pin.length !== 4 || submitting}
                    onClick={() => void submit({ pin, ...(coordsRef.current ?? {}) })}
                    style={{ marginTop: 10, width: '100%', height: 46, borderRadius: 11, background: pin.length === 4 && !submitting ? '#111827' : '#d1d5db', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: pin.length === 4 && !submitting ? 'pointer' : 'default' }}
                  >
                    {submitting ? '처리 중…' : '사용 처리'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  style={{ marginTop: 10, width: '100%', height: 42, borderRadius: 11, background: '#f3f4f6', color: '#374151', fontSize: 13.5, fontWeight: 600, border: 'none', cursor: 'pointer' }}
                >
                  닫기
                </button>
              </div>
            )}

            {phase === 'error' && (
              <div style={{ marginTop: 14 }}>
                <p style={{ fontSize: 13, color: '#dc2626', lineHeight: 1.6 }}>{err}</p>
                {/* '이미 사용/혜택 없음'처럼 PIN으로 해결 안 되는 에러가 아니면 PIN 입구 제공 */}
                {canPin && (
                  <button
                    type="button"
                    onClick={() => setPhase('pin')}
                    style={{ marginTop: 10, width: '100%', height: 44, borderRadius: 11, background: '#111827', color: '#fff', fontSize: 13.5, fontWeight: 700, border: 'none', cursor: 'pointer' }}
                  >
                    가게 PIN으로 사용하기
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  style={{ marginTop: 8, width: '100%', height: 42, borderRadius: 11, background: '#f3f4f6', color: '#374151', fontSize: 13.5, fontWeight: 600, border: 'none', cursor: 'pointer' }}
                >
                  닫기
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

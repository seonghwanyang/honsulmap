'use client';

// 좌석별 QR 인쇄 페이지 — 배치도의 좌석마다 /t/{slug}?seat=N QR 카드를 생성.
// 브라우저 인쇄(Ctrl+P)로 뽑아 테이블에 부착한다. A4 기준 3열 카드.

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import QRCode from 'qrcode';
import AuthGate from '../../../../AuthGate';
import TesterGate from '../../../../TesterGate';
import { Spinner, buttonStyle } from '../../../../ui';

interface SeatQR {
  label: string;
  zone: string;
  url: string;
  dataUrl: string;
}

function QrSheet() {
  const { id } = useParams<{ id: string }>();
  const [spot, setSpot] = useState<{ name: string; slug: string } | null>(null);
  const [cards, setCards] = useState<SeatQR[]>([]);
  const [loading, setLoading] = useState(true);
  // 가게마다 부착 사이즈가 달라 카드 높이(cm)·자르기 간격을 화면에서 조절 (가게별 기억).
  // 기본 6cm = 테이블 부착 표준 (2026-08-31 확정 디자인: 랜딩 톤 다크 카드).
  const [heightCm, setHeightCm] = useState(6);
  const [gap, setGap] = useState(16);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`hsm_qr_opts_${id}`) ?? 'null');
      if (saved?.heightCm) setHeightCm(saved.heightCm);
      if (saved?.gap) setGap(saved.gap);
    } catch {
      /* 기본값 유지 */
    }
  }, [id]);

  useEffect(() => {
    try {
      localStorage.setItem(`hsm_qr_opts_${id}`, JSON.stringify({ heightCm, gap }));
    } catch {
      /* 저장 실패 무시 */
    }
  }, [id, heightCm, gap]);

  // 6cm 기준 비율 스케일 — 폰트·QR·여백이 카드 높이에 비례
  const sc = heightCm / 6;

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/partner/spots/${id}/tables`);
      if (!res.ok) return setLoading(false);
      const d = await res.json();
      setSpot(d.spot ?? null);
      const origin = window.location.origin;
      const list: SeatQR[] = [];
      for (const z of d.zones ?? []) {
        for (const s of z.seats ?? []) {
          if (s.seat_type === 'block') continue;
          // 한글 slug도 스캐너가 안전하게 읽도록 퍼센트 인코딩
          const url = `${origin}/t/${encodeURIComponent(d.spot?.slug ?? '')}?seat=${encodeURIComponent(s.label)}`;
          const dataUrl = await QRCode.toDataURL(url, { width: 640, margin: 1, color: { dark: '#111827', light: '#ffffff' } });
          list.push({ label: s.label, zone: z.name, url, dataUrl });
        }
      }
      list.sort((a, b) => a.label.localeCompare(b.label, 'ko', { numeric: true }));
      setCards(list);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <Spinner label="QR 생성 중…" />;

  return (
    <div>
      {/* 인쇄 시 컨트롤 숨김. 카드 간격은 자르기 여백이라 인쇄에서도 유지 —
          점선 테두리가 가위선 가이드 역할. A4를 넘치면 브라우저가 자동으로 2~3장 분할. */}
      <style>{`
        @media print {
          .qr-controls { display: none !important; }
          .qr-card { break-inside: avoid; }
          nav, header { display: none !important; }
          @page { margin: 10mm; }
        }
      `}</style>

      <div className="qr-controls" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', letterSpacing: '-0.4px' }}>좌석 QR 인쇄</h1>
          <p style={{ fontSize: 12.5, color: '#6b7280', marginTop: 4 }}>
            {spot?.name} · {cards.length}개 좌석 · 점선대로 잘라 좌석/테이블에 붙여주세요.
          </p>
        </div>
        <Link href={`/partner/spot/${id}/tables`} style={{ ...buttonStyle('outline'), height: 40, padding: '0 14px', fontSize: 13 }}>
          ← 배치도
        </Link>
        <button onClick={() => window.print()} style={{ ...buttonStyle('primary'), height: 40, padding: '0 18px', fontSize: 13 }}>
          🖨 인쇄 / PDF 저장
        </button>
      </div>

      {/* 크기·간격 조절 — 가게마다 부착 위치가 달라서 (설정은 이 가게에 기억됨) */}
      <div className="qr-controls" style={{ display: 'flex', alignItems: 'center', gap: 22, flexWrap: 'wrap', marginBottom: 18, padding: '12px 16px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, fontWeight: 700, color: '#374151' }}>
          카드 높이
          <input type="range" min={4} max={8} step={0.5} value={heightCm} onChange={(e) => setHeightCm(Number(e.target.value))} style={{ width: 140 }} />
          <span style={{ color: '#6b7280', fontVariantNumeric: 'tabular-nums', width: 46 }}>{heightCm}cm</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, fontWeight: 700, color: '#374151' }}>
          자르기 간격
          <input type="range" min={6} max={40} step={2} value={gap} onChange={(e) => setGap(Number(e.target.value))} style={{ width: 140 }} />
          <span style={{ color: '#6b7280', fontVariantNumeric: 'tabular-nums', width: 46 }}>{gap}px</span>
        </label>
        <span style={{ fontSize: 11.5, color: '#9ca3af' }}>
          인쇄 시 "배경 그래픽" 옵션을 켜야 다크 카드가 나와요 · "PDF로 저장" 선택 시 PDF로 한 번에
        </span>
      </div>

      {cards.length === 0 && (
        <p style={{ color: '#9ca3af', fontSize: 13.5, textAlign: 'center', padding: '40px 0' }}>
          배치도에 좌석을 먼저 배치하고 저장해주세요.
        </p>
      )}

      <div className="qr-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${(heightCm * 0.867).toFixed(2)}cm)`, gap, justifyContent: 'start' }}>
        {cards.map((c) => (
          // 바깥 점선 = 가위 재단 가이드
          <div key={`${c.zone}-${c.label}`} style={{ border: '1px dashed #d1d5db', padding: 3, borderRadius: 14, breakInside: 'avoid' }}>
            <div
              className="qr-card"
              style={{
                width: `${(heightCm * 0.867).toFixed(2)}cm`,
                height: `${heightCm}cm`,
                borderRadius: 12,
                overflow: 'hidden',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: `${13 * sc}px ${10 * sc}px ${9 * sc}px`,
                background:
                  'radial-gradient(130% 100% at 18% 0%, rgba(255,236,210,0.13) 0%, rgba(255,236,210,0) 55%), radial-gradient(120% 85% at 50% 0%, #1b1b1f 0%, #0c0c0e 100%)',
                WebkitPrintColorAdjust: 'exact',
                printColorAdjust: 'exact',
              }}
            >
              <div style={{ fontSize: 14 * sc, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1.2, wordBreak: 'keep-all' }}>
                {spot?.name}
              </div>
              <div style={{ background: '#fff', borderRadius: 8 * sc, padding: 6 * sc, marginTop: 8 * sc, boxShadow: '0 0 0 1.5px #EAB308' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.dataUrl} alt={`Seat ${c.label} QR`} style={{ display: 'block', width: 122 * sc, height: 122 * sc }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 * sc, marginTop: 9 * sc }}>
                <span style={{ width: 15 * sc, height: 1, background: 'rgba(255,255,255,0.22)' }} />
                <span style={{ fontSize: 13 * sc, letterSpacing: 4, color: '#EAB308', fontFamily: "Georgia, 'Times New Roman', serif" }}>
                  SEAT {c.label}
                </span>
                <span style={{ width: 15 * sc, height: 1, background: 'rgba(255,255,255,0.22)' }} />
              </div>
              <div style={{ fontSize: 8.5 * sc, letterSpacing: 3, color: 'rgba(255,255,255,0.42)', marginTop: 6 * sc, fontWeight: 700 }}>혼술맵</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function QrPage() {
  return (
    <AuthGate>
      <TesterGate>
        <QrSheet />
      </TesterGate>
    </AuthGate>
  );
}

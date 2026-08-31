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
  // 가게마다 부착 사이즈가 달라 QR 크기·자르기 간격을 화면에서 조절 (가게별 기억)
  const [qrSize, setQrSize] = useState(170);
  const [gap, setGap] = useState(16);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`hsm_qr_opts_${id}`) ?? 'null');
      if (saved?.qrSize) setQrSize(saved.qrSize);
      if (saved?.gap) setGap(saved.gap);
    } catch {
      /* 기본값 유지 */
    }
  }, [id]);

  useEffect(() => {
    try {
      localStorage.setItem(`hsm_qr_opts_${id}`, JSON.stringify({ qrSize, gap }));
    } catch {
      /* 저장 실패 무시 */
    }
  }, [id, qrSize, gap]);

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
          .qr-card { break-inside: avoid; border: 1px dashed #d1d5db !important; }
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
          QR 크기
          <input type="range" min={110} max={320} step={10} value={qrSize} onChange={(e) => setQrSize(Number(e.target.value))} style={{ width: 140 }} />
          <span style={{ color: '#6b7280', fontVariantNumeric: 'tabular-nums', width: 46 }}>{qrSize}px</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, fontWeight: 700, color: '#374151' }}>
          자르기 간격
          <input type="range" min={6} max={40} step={2} value={gap} onChange={(e) => setGap(Number(e.target.value))} style={{ width: 140 }} />
          <span style={{ color: '#6b7280', fontVariantNumeric: 'tabular-nums', width: 46 }}>{gap}px</span>
        </label>
        <span style={{ fontSize: 11.5, color: '#9ca3af' }}>인쇄 대화상자에서 "PDF로 저장"을 고르면 PDF로 한 번에 나와요</span>
      </div>

      {cards.length === 0 && (
        <p style={{ color: '#9ca3af', fontSize: 13.5, textAlign: 'center', padding: '40px 0' }}>
          배치도에 좌석을 먼저 배치하고 저장해주세요.
        </p>
      )}

      <div className="qr-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${qrSize + 48}px, 1fr))`, gap }}>
        {cards.map((c) => (
          <div
            key={`${c.zone}-${c.label}`}
            className="qr-card"
            style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: '18px 14px 14px', textAlign: 'center', background: '#fff' }}
          >
            <div style={{ fontSize: Math.max(16, Math.round(qrSize * 0.115)), fontWeight: 800, color: '#111827', letterSpacing: '-0.4px', lineHeight: 1.25, wordBreak: 'keep-all', marginBottom: 12 }}>
              {spot?.name}
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.dataUrl} alt={`Seat ${c.label} QR`} style={{ display: 'block', width: qrSize, height: qrSize, margin: '0 auto' }} />
            <div style={{ fontSize: Math.max(20, Math.round(qrSize * 0.14)), fontWeight: 800, color: '#111827', marginTop: 12 }}>Seat {c.label}</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', letterSpacing: '3px', marginTop: 8 }}>혼술맵</div>
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

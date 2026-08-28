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
          const dataUrl = await QRCode.toDataURL(url, { width: 480, margin: 1, color: { dark: '#111827', light: '#ffffff' } });
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
      {/* 인쇄 시 컨트롤 숨김 */}
      <style>{`
        @media print {
          .qr-controls { display: none !important; }
          .qr-grid { gap: 0 !important; }
          .qr-card { break-inside: avoid; border: 1px dashed #d1d5db !important; }
          nav, header { display: none !important; }
        }
      `}</style>

      <div className="qr-controls" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', letterSpacing: '-0.4px' }}>좌석 QR 인쇄</h1>
          <p style={{ fontSize: 12.5, color: '#6b7280', marginTop: 4 }}>
            {spot?.name} · {cards.length}개 좌석 · 인쇄해서 좌석/테이블에 붙여주세요.
          </p>
        </div>
        <Link href={`/partner/spot/${id}/tables`} style={{ ...buttonStyle('outline'), height: 40, padding: '0 14px', fontSize: 13 }}>
          ← 배치도
        </Link>
        <button onClick={() => window.print()} style={{ ...buttonStyle('primary'), height: 40, padding: '0 18px', fontSize: 13 }}>
          🖨 인쇄하기
        </button>
      </div>

      {cards.length === 0 && (
        <p style={{ color: '#9ca3af', fontSize: 13.5, textAlign: 'center', padding: '40px 0' }}>
          배치도에 좌석을 먼저 배치하고 저장해주세요.
        </p>
      )}

      <div className="qr-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
        {cards.map((c) => (
          <div
            key={`${c.zone}-${c.label}`}
            className="qr-card"
            style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: '18px 14px', textAlign: 'center', background: '#fff' }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', letterSpacing: '0.5px' }}>{spot?.name}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: '3px 0 10px', letterSpacing: '-0.2px' }}>주문은 여기서</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.dataUrl} alt={`Seat ${c.label} QR`} style={{ display: 'block', width: '100%', maxWidth: 170, aspectRatio: '1', margin: '0 auto' }} />
            <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginTop: 10 }}>Seat {c.label}</div>
            <div style={{ fontSize: 9.5, color: '#9ca3af', marginTop: 5, wordBreak: 'break-all' }}>{c.url.replace(/^https?:\/\//, '')}</div>
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

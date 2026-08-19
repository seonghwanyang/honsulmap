import { supabase } from '@/lib/supabase';
import type { Metadata } from 'next';

// 테이블 서비스 손님 진입점 — 좌석 QR(/t/{slug}?seat=N)이 여는 페이지.
// S1: 배치도(좌석맵) 렌더까지. 체크인·메뉴·주문은 다음 슬라이스에서 붙는다.

export const dynamic = 'force-dynamic';

interface Zone {
  id: string;
  name: string;
  grid_rows: number;
  grid_cols: number;
  sort: number;
}
interface Seat {
  id: string;
  zone_id: string;
  label: string;
  row: number;
  col: number;
  seat_type: 'seat' | 'buffer' | 'block';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { data: spot } = await supabase.from('spots').select('name').eq('slug', slug).maybeSingle();
  return {
    title: spot ? `${spot.name} 테이블 | 혼술맵` : '테이블 | 혼술맵',
    robots: { index: false }, // 테이블 전용 페이지는 검색 노출 제외
  };
}

export default async function TablePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ seat?: string }>;
}) {
  const { slug } = await params;
  const { seat: mySeat } = await searchParams;

  const { data: spot } = await supabase
    .from('spots')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (!spot) return <Shell title="혼술맵 테이블">가게를 찾을 수 없어요.</Shell>;

  const [{ data: config }, { data: zones }, { data: seats }] = await Promise.all([
    supabase.from('store_table_config').select('enabled, live_status').eq('spot_id', spot.id).maybeSingle(),
    supabase.from('store_zones').select('*').eq('spot_id', spot.id).order('sort'),
    supabase.from('store_seats').select('*').eq('spot_id', spot.id).eq('active', true),
  ]);

  if (!config?.enabled) {
    return (
      <Shell title={spot.name}>
        아직 테이블 서비스 준비 중이에요.
        <br />
        직원에게 직접 주문해주세요 🙂
      </Shell>
    );
  }

  const zoneList = (zones ?? []) as Zone[];
  const seatList = (seats ?? []) as Seat[];

  return (
    <div style={{ minHeight: '100dvh', background: '#f8f9fa' }}>
      {/* 헤더 */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid #e5e7eb',
          padding: '14px 18px',
        }}
      >
        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.3px' }}>
          혼술맵 테이블
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 2 }}>
          <h1 style={{ fontSize: 19, fontWeight: 800, color: '#111827', letterSpacing: '-0.4px' }}>
            {spot.name}
          </h1>
          {mySeat && (
            <span style={{ fontSize: 13.5, fontWeight: 800, color: '#7c3aed' }}>Seat {mySeat}</span>
          )}
        </div>
        <p style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 3 }}>
          계산은 좌석 번호를 직원에게 말씀해주세요.
        </p>
      </div>

      {/* 좌석맵 */}
      <div style={{ padding: '18px 16px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {zoneList.length === 0 && (
          <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: '40px 0' }}>
            배치도가 아직 등록되지 않았어요.
          </p>
        )}

        {zoneList.map((z) => {
          const zSeats = seatList.filter((s) => s.zone_id === z.id);
          return (
            <section
              key={z.id}
              style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: 16 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ fontSize: 14, fontWeight: 800, color: '#111827', letterSpacing: '-0.2px' }}>
                  {z.name}
                </h2>
                <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>
                  좌석 {zSeats.filter((s) => s.seat_type === 'seat').length}
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${z.grid_cols}, minmax(34px, 1fr))`,
                    gap: 5,
                    minWidth: z.grid_cols * 39,
                  }}
                >
                  {Array.from({ length: z.grid_rows * z.grid_cols }, (_, i) => {
                    const row = Math.floor(i / z.grid_cols);
                    const col = i % z.grid_cols;
                    const seat = zSeats.find((s) => s.row === row && s.col === col);
                    if (!seat) return <div key={i} style={{ aspectRatio: '1' }} />;
                    const mine = mySeat && seat.label === mySeat && seat.seat_type === 'seat';
                    return (
                      <div
                        key={i}
                        style={{
                          aspectRatio: '1',
                          borderRadius: 9,
                          display: 'grid',
                          placeItems: 'center',
                          fontSize: 11.5,
                          fontWeight: 800,
                          ...(seat.seat_type === 'block'
                            ? { background: '#f3f4f6', color: 'transparent' }
                            : seat.seat_type === 'buffer'
                              ? { border: '1.6px dashed #d1d5db', color: '#9ca3af' }
                              : mine
                                ? { background: '#7c3aed', color: '#fff' }
                                : { background: '#fff', border: '1.6px solid #d1d5db', color: '#374151' }),
                        }}
                      >
                        {seat.seat_type === 'block' ? '' : seat.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}

        {/* 범례 */}
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
          <Legend swatch={{ background: '#fff', border: '1.6px solid #d1d5db' }}>좌석</Legend>
          <Legend swatch={{ background: '#7c3aed' }}>내 자리</Legend>
          <Legend swatch={{ border: '1.6px dashed #d1d5db' }}>대기석</Legend>
          <Legend swatch={{ background: '#f3f4f6' }}>테이블</Legend>
        </div>
      </div>
    </div>
  );
}

function Legend({ swatch, children }: { swatch: React.CSSProperties; children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 13, height: 13, borderRadius: 4, ...swatch }} />
      {children}
    </span>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: '#f8f9fa',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.3px' }}>
          혼술맵 테이블
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: '6px 0 14px' }}>{title}</h1>
        <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>{children}</p>
      </div>
    </div>
  );
}

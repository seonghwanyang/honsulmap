'use client';

// 테이블 배치도 에디터 — 구역을 만들고 그리드 셀을 탭해서 좌석을 놓는다.
// 자유 캔버스가 아니라 그리드 스냅: 표 그리듯 찍으면 손님 좌석맵이 된다.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AuthGate from '../../../AuthGate';
import { Card, PageHeader, Spinner, buttonStyle, PlusIcon } from '../../../ui';

type SeatType = 'seat' | 'buffer' | 'block';
type Tool = SeatType | 'erase';

interface EditorSeat {
  label: string;
  row: number;
  col: number;
  seat_type: SeatType;
}
interface EditorZone {
  key: string;
  name: string;
  grid_rows: number;
  grid_cols: number;
  seats: EditorSeat[];
}

const TOOLS: { value: Tool; label: string; hint: string }[] = [
  { value: 'seat', label: '좌석', hint: '번호 자동' },
  { value: 'block', label: '테이블', hint: '장식(스캔 불가)' },
  { value: 'buffer', label: '대기석', hint: '자리이동 대기' },
  { value: 'erase', label: '지우개', hint: '셀 비우기' },
];

let localKey = 0;
const newKey = () => `z${++localKey}`;

function TablesEditor() {
  const { id } = useParams<{ id: string }>();
  const [zones, setZones] = useState<EditorZone[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [spot, setSpot] = useState<{ name: string; slug: string } | null>(null);
  const [tool, setTool] = useState<Tool>('seat');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch(`/api/partner/spots/${id}/tables`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setSpot(d.spot ?? null);
        setEnabled(!!d.config?.enabled);
        setZones(
          (d.zones ?? []).map(
            (z: { name: string; grid_rows: number; grid_cols: number; seats: EditorSeat[] }) => ({
              key: newKey(),
              name: z.name,
              grid_rows: z.grid_rows,
              grid_cols: z.grid_cols,
              seats: (z.seats ?? []).map((s) => ({
                label: s.label,
                row: s.row,
                col: s.col,
                seat_type: s.seat_type,
              })),
            }),
          ),
        );
      })
      .finally(() => setLoading(false));
  }, [id]);

  // 전 구역 통틀어 다음 좌석 번호 (숫자 라벨 최대값 + 1)
  const nextSeatNo = useMemo(() => {
    let max = 0;
    for (const z of zones)
      for (const s of z.seats) {
        const n = parseInt(s.label, 10);
        if (!Number.isNaN(n) && n > max) max = n;
      }
    return max + 1;
  }, [zones]);

  const mutateZone = useCallback((key: string, fn: (z: EditorZone) => EditorZone) => {
    setZones((prev) => prev.map((z) => (z.key === key ? fn(z) : z)));
    setDirty(true);
  }, []);

  const tapCell = (zoneKey: string, row: number, col: number) => {
    mutateZone(zoneKey, (z) => {
      const rest = z.seats.filter((s) => !(s.row === row && s.col === col));
      if (tool === 'erase') return { ...z, seats: rest };
      const label = tool === 'seat' ? String(nextSeatNo) : tool === 'block' ? '테이블' : '대기';
      return { ...z, seats: [...rest, { label, row, col, seat_type: tool }] };
    });
  };

  const renumber = () => {
    let n = 1;
    setZones((prev) =>
      prev.map((z) => ({
        ...z,
        seats: [...z.seats]
          .sort((a, b) => a.row - b.row || a.col - b.col)
          .map((s) => (s.seat_type === 'seat' ? { ...s, label: String(n++) } : s)),
      })),
    );
    setDirty(true);
  };

  const addZone = () => {
    setZones((prev) => [
      ...prev,
      { key: newKey(), name: `구역 ${prev.length + 1}`, grid_rows: 4, grid_cols: 7, seats: [] },
    ]);
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/partner/spots/${id}/tables`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled,
        zones: zones.map((z) => ({
          name: z.name,
          grid_rows: z.grid_rows,
          grid_cols: z.grid_cols,
          seats: z.seats,
        })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || '저장에 실패했어요.');
      return;
    }
    setDirty(false);
  };

  if (loading) return <Spinner />;

  const seatCount = zones.reduce(
    (acc, z) => acc + z.seats.filter((s) => s.seat_type === 'seat').length,
    0,
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="테이블 배치도"
        subtitle={`${spot?.name ?? ''} · 셀을 탭해서 좌석을 배치하세요. 좌석 ${seatCount}개`}
        action={
          <button onClick={save} disabled={saving || !dirty} style={buttonStyle('primary', { disabled: saving || !dirty })}>
            {saving ? '저장 중…' : dirty ? '저장하기' : '저장됨'}
          </button>
        }
      />

      {/* 서비스 on/off + 손님 페이지 링크 */}
      <Card style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13.5, fontWeight: 700, color: '#111827' }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setDirty(true);
            }}
            style={{ width: 18, height: 18, accentColor: '#111827' }}
          />
          테이블 서비스 활성화
        </label>
        {spot && (
          <Link
            href={`/t/${spot.slug}`}
            target="_blank"
            style={{ fontSize: 12.5, fontWeight: 700, color: '#2563eb', textDecoration: 'none', marginLeft: 'auto' }}
          >
            손님 페이지 미리보기 → /t/{spot.slug}
          </Link>
        )}
      </Card>

      {/* 도구 팔레트 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {TOOLS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTool(t.value)}
            style={{
              padding: '9px 14px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              border: '1px solid',
              borderColor: tool === t.value ? '#111827' : '#e5e7eb',
              background: tool === t.value ? '#111827' : '#fff',
              color: tool === t.value ? '#fff' : '#374151',
              cursor: 'pointer',
            }}
          >
            {t.label}
            <span style={{ fontSize: 10.5, fontWeight: 600, opacity: 0.65, marginLeft: 5 }}>{t.hint}</span>
          </button>
        ))}
        <button
          onClick={renumber}
          style={{ ...buttonStyle('outline'), height: 38, padding: '0 14px', fontSize: 12.5, marginLeft: 'auto' }}
        >
          번호 다시 매기기
        </button>
      </div>

      {zones.map((z) => (
        <Card key={z.key} style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <input
              value={z.name}
              onChange={(e) => mutateZone(z.key, (zz) => ({ ...zz, name: e.target.value }))}
              maxLength={20}
              style={{
                width: 140,
                height: 38,
                padding: '0 12px',
                borderRadius: 9,
                border: '1px solid #e5e7eb',
                fontSize: 13.5,
                fontWeight: 700,
                color: '#111827',
                outline: 'none',
              }}
            />
            <GridStepper
              label="행"
              value={z.grid_rows}
              min={1}
              max={20}
              onChange={(v) =>
                mutateZone(z.key, (zz) => ({ ...zz, grid_rows: v, seats: zz.seats.filter((s) => s.row < v) }))
              }
            />
            <GridStepper
              label="열"
              value={z.grid_cols}
              min={1}
              max={12}
              onChange={(v) =>
                mutateZone(z.key, (zz) => ({ ...zz, grid_cols: v, seats: zz.seats.filter((s) => s.col < v) }))
              }
            />
            <button
              onClick={() => {
                if (!confirm(`'${z.name}' 구역을 삭제할까요?`)) return;
                setZones((prev) => prev.filter((x) => x.key !== z.key));
                setDirty(true);
              }}
              style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              구역 삭제
            </button>
          </div>

          <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${z.grid_cols}, minmax(38px, 1fr))`,
                gap: 5,
                minWidth: z.grid_cols * 43,
              }}
            >
              {Array.from({ length: z.grid_rows * z.grid_cols }, (_, i) => {
                const row = Math.floor(i / z.grid_cols);
                const col = i % z.grid_cols;
                const seat = z.seats.find((s) => s.row === row && s.col === col);
                return (
                  <button
                    key={i}
                    onClick={() => tapCell(z.key, row, col)}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 9,
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      ...cellStyle(seat?.seat_type)
                    }}
                  >
                    {seat?.seat_type === 'block' ? '' : seat?.label ?? ''}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      ))}

      <button onClick={addZone} style={{ ...buttonStyle('outline'), alignSelf: 'flex-start' }}>
        <PlusIcon />
        구역 추가 (내측 / 창측 / 바 …)
      </button>
    </div>
  );
}

function cellStyle(type?: SeatType): React.CSSProperties {
  switch (type) {
    case 'seat':
      return { background: '#fff', border: '1.8px solid #111827', color: '#111827' };
    case 'block':
      return { background: '#e5e7eb', border: '1px solid #e5e7eb', color: '#9ca3af' };
    case 'buffer':
      return { background: '#fff', border: '1.8px dashed #9ca3af', color: '#6b7280' };
    default:
      return { background: '#f8f9fa', border: '1px solid #f0f1f3', color: 'transparent' };
  }
}

function GridStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const btn: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 7,
    border: '1px solid #e5e7eb',
    background: '#fff',
    color: '#374151',
    fontWeight: 800,
    cursor: 'pointer',
    lineHeight: 1,
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#6b7280', fontWeight: 700 }}>
      {label}
      <button style={btn} onClick={() => value > min && onChange(value - 1)}>−</button>
      <span style={{ minWidth: 18, textAlign: 'center', color: '#111827' }}>{value}</span>
      <button style={btn} onClick={() => value < max && onChange(value + 1)}>+</button>
    </span>
  );
}

export default function TablesPage() {
  return (
    <AuthGate>
      <TablesEditor />
    </AuthGate>
  );
}

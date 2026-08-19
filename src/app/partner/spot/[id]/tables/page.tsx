'use client';

// 테이블 배치도 에디터 — 구역을 만들고 그리드 셀을 탭해서 좌석을 놓는다.
// 도구 팔레트는 구역 카드마다 있고, 같은 도구로 다시 탭하면 지워진다(토글).
//
// 저장은 두 층위로 분리:
//  · [구역 저장]      — 그 구역만 반영. 다른 구역의 미저장 변경은 딸려가지
//                       않도록 "마지막 저장 스냅샷 + 이 구역 교체"로 전송.
//  · [모든 설정 저장] — 전체 반영. 구역 삭제·서비스 활성화는 여기서만 확정.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const TOOLS: { value: Tool; label: string }[] = [
  { value: 'seat', label: '🪑 좌석 추가' },
  { value: 'block', label: '⬛ 테이블 추가' },
  { value: 'buffer', label: '⏳ 대기석 추가' },
  { value: 'erase', label: '🧹 지우기' },
];

let localKey = 0;
const newKey = () => `z${++localKey}`;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function TablesEditor() {
  const { id } = useParams<{ id: string }>();
  const [zones, setZones] = useState<EditorZone[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [spot, setSpot] = useState<{ name: string; slug: string } | null>(null);
  const [tool, setTool] = useState<Tool>('seat');
  const [loading, setLoading] = useState(true);
  // saving: 'all' 또는 저장 중인 구역 key
  const [saving, setSaving] = useState<'all' | string | null>(null);
  const [dirtyZones, setDirtyZones] = useState<Set<string>>(new Set());
  const [globalDirty, setGlobalDirty] = useState(false);
  // 서버에 저장돼 있는 상태의 스냅샷 — 구역별 저장의 기준점
  const savedRef = useRef<EditorZone[]>([]);

  useEffect(() => {
    fetch(`/api/partner/spots/${id}/tables`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setSpot(d.spot ?? null);
        setEnabled(!!d.config?.enabled);
        const loaded: EditorZone[] = (d.zones ?? []).map(
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
        );
        setZones(loaded);
        savedRef.current = clone(loaded);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const nextSeatNo = useMemo(() => {
    let max = 0;
    for (const z of zones)
      for (const s of z.seats) {
        const n = parseInt(s.label, 10);
        if (!Number.isNaN(n) && n > max) max = n;
      }
    return max + 1;
  }, [zones]);

  const markZone = useCallback((key: string) => {
    setDirtyZones((prev) => new Set(prev).add(key));
  }, []);

  const mutateZone = useCallback(
    (key: string, fn: (z: EditorZone) => EditorZone) => {
      setZones((prev) => prev.map((z) => (z.key === key ? fn(z) : z)));
      markZone(key);
    },
    [markZone],
  );

  const tapCell = (zoneKey: string, row: number, col: number) => {
    mutateZone(zoneKey, (z) => {
      const existing = z.seats.find((s) => s.row === row && s.col === col);
      const rest = z.seats.filter((s) => !(s.row === row && s.col === col));
      if (tool === 'erase') return { ...z, seats: rest };
      // 같은 도구로 놓인 셀을 다시 탭하면 지워진다 (토글) — 다른 타입이면 교체
      if (existing?.seat_type === tool) return { ...z, seats: rest };
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
    setDirtyZones((prev) => {
      const next = new Set(prev);
      zones.forEach((z) => next.add(z.key));
      return next;
    });
  };

  const addZone = () => {
    const key = newKey();
    setZones((prev) => [
      ...prev,
      { key, name: `구역 ${prev.length + 1}`, grid_rows: 4, grid_cols: 7, seats: [] },
    ]);
    markZone(key);
  };

  const payload = (list: EditorZone[]) =>
    list.map((z) => ({ name: z.name, grid_rows: z.grid_rows, grid_cols: z.grid_cols, seats: z.seats }));

  const put = async (body: object) => {
    const res = await fetch(`/api/partner/spots/${id}/tables`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || '저장에 실패했어요.');
      return false;
    }
    return true;
  };

  // 전체 저장 — 삭제·활성화 포함 현재 화면 그대로 확정
  const saveAll = async () => {
    setSaving('all');
    const ok = await put({ enabled, zones: payload(zones) });
    setSaving(null);
    if (!ok) return;
    savedRef.current = clone(zones);
    setDirtyZones(new Set());
    setGlobalDirty(false);
  };

  // 구역 저장 — 스냅샷에서 이 구역만 교체해 전송 (다른 미저장 변경 미포함)
  const saveZone = async (key: string) => {
    const zone = zones.find((z) => z.key === key);
    if (!zone) return;
    const base = clone(savedRef.current);
    const idx = base.findIndex((z) => z.key === key);
    if (idx >= 0) base[idx] = clone(zone);
    else base.push(clone(zone));
    setSaving(key);
    const ok = await put({ zones: payload(base) });
    setSaving(null);
    if (!ok) return;
    savedRef.current = base;
    setDirtyZones((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  };

  if (loading) return <Spinner />;

  const anyDirty = dirtyZones.size > 0 || globalDirty;
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
          <button
            onClick={saveAll}
            disabled={saving !== null || !anyDirty}
            style={buttonStyle('primary', { disabled: saving !== null || !anyDirty })}
          >
            {saving === 'all' ? '저장 중…' : anyDirty ? '모든 설정 저장' : '저장됨'}
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
              setGlobalDirty(true);
            }}
            style={{ width: 18, height: 18, accentColor: '#111827' }}
          />
          테이블 서비스 활성화
          <span style={{ fontWeight: 600, fontSize: 11.5, color: '#9ca3af' }}>(모든 설정 저장 시 반영)</span>
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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href={`/partner/spot/${id}/menu`} style={{ ...buttonStyle('outline'), height: 38, padding: '0 14px', fontSize: 12.5 }}>
          메뉴 관리 →
        </Link>
        <Link href={`/partner/spot/${id}/orders`} style={{ ...buttonStyle('outline'), height: 38, padding: '0 14px', fontSize: 12.5 }}>
          주문 보드 →
        </Link>
        <Link href={`/partner/spot/${id}/quests`} style={{ ...buttonStyle('outline'), height: 38, padding: '0 14px', fontSize: 12.5 }}>
          퀘스트 →
        </Link>
        <Link href={`/partner/spot/${id}/tables/qr`} style={{ ...buttonStyle('outline'), height: 38, padding: '0 14px', fontSize: 12.5 }}>
          🖨 QR 인쇄 →
        </Link>
        <button
          onClick={renumber}
          style={{ ...buttonStyle('outline'), height: 38, padding: '0 14px', fontSize: 12.5, marginLeft: 'auto' }}
        >
          번호 다시 매기기
        </button>
      </div>

      {zones.map((z) => {
        const zDirty = dirtyZones.has(z.key);
        return (
          <Card key={z.key} style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
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
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={() => saveZone(z.key)}
                  disabled={saving !== null || !zDirty}
                  style={{ height: 34, padding: '0 16px', borderRadius: 9, fontSize: 12, fontWeight: 800, border: 'none', background: zDirty ? '#111827' : '#f3f4f6', color: zDirty ? '#fff' : '#9ca3af', cursor: zDirty && saving === null ? 'pointer' : 'default' }}
                >
                  {saving === z.key ? '저장 중…' : zDirty ? '구역 저장' : '저장됨'}
                </button>
                <button
                  onClick={() => {
                    if (!confirm(`'${z.name}' 구역을 삭제할까요?\n삭제는 [모든 설정 저장]을 눌러야 최종 반영돼요.`)) return;
                    setZones((prev) => prev.filter((x) => x.key !== z.key));
                    setDirtyZones((prev) => {
                      const next = new Set(prev);
                      next.delete(z.key);
                      return next;
                    });
                    setGlobalDirty(true);
                  }}
                  style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  구역 삭제
                </button>
              </div>
            </div>

            {/* 구역별 도구 팔레트 */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {TOOLS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTool(t.value)}
                  style={{
                    padding: '7px 12px',
                    borderRadius: 9,
                    fontSize: 12,
                    fontWeight: 800,
                    border: '1px solid',
                    borderColor: tool === t.value ? '#111827' : '#e5e7eb',
                    background: tool === t.value ? '#111827' : '#fff',
                    color: tool === t.value ? '#fff' : '#374151',
                    cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              ))}
              <span style={{ alignSelf: 'center', fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>
                좌석은 번호 자동 · 테이블은 장식용 · 같은 걸 다시 탭하면 지워져요
              </span>
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
        );
      })}

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

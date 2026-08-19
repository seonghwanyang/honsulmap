'use client';

// 테이블 설정 허브 — 배치도·메뉴·퀘스트를 아코디언 섹션으로 한 페이지에서.
// 주문 보드(/orders)는 영업 중 켜두는 화면이라 의도적으로 분리 유지.
// 섹션은 접혀도 unmount하지 않는다(미저장 편집 보존) — display 토글만.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AuthGate from '../../../AuthGate';
import { Card, PageHeader, Spinner, buttonStyle, PlusIcon } from '../../../ui';
import MenuSection from './MenuSection';
import QuestsSection from './QuestsSection';

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

// ═══ 허브 ═══

type SectionKey = 'layout' | 'menu' | 'quests';

function TablesHub() {
  const { id } = useParams<{ id: string }>();
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({ layout: true, menu: false, quests: false });
  const [dirtyMap, setDirtyMap] = useState<Record<SectionKey, boolean>>({ layout: false, menu: false, quests: false });

  const setDirty = useCallback((key: SectionKey) => (d: boolean) => {
    setDirtyMap((prev) => (prev[key] === d ? prev : { ...prev, [key]: d }));
  }, []);

  const toggle = (key: SectionKey) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        title="테이블 설정"
        subtitle="배치도·메뉴·퀘스트를 한 곳에서 세팅하세요. 영업 중엔 주문 보드를 켜두면 돼요."
        action={
          <Link href={`/partner/spot/${id}/orders`} style={buttonStyle('primary')}>
            주문 보드 열기 →
          </Link>
        }
      />

      <Section title="🪑 좌석 배치도" open={open.layout} dirty={dirtyMap.layout} onToggle={() => toggle('layout')}>
        <LayoutSection spotId={id} onDirtyChange={setDirty('layout')} />
      </Section>
      <Section title="🍶 메뉴판" open={open.menu} dirty={dirtyMap.menu} onToggle={() => toggle('menu')}>
        <MenuSection spotId={id} onDirtyChange={setDirty('menu')} />
      </Section>
      <Section title="🎯 오늘의 퀘스트" open={open.quests} dirty={dirtyMap.quests} onToggle={() => toggle('quests')}>
        <QuestsSection spotId={id} onDirtyChange={setDirty('quests')} />
      </Section>
    </div>
  );
}

function Section({
  title,
  open,
  dirty,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  dirty: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: '#fff',
          border: `1.5px solid ${open ? '#111827' : '#e5e7eb'}`,
          borderRadius: 14,
          padding: '15px 18px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 800, color: '#111827', letterSpacing: '-0.3px' }}>{title}</span>
        {dirty && (
          <span style={{ fontSize: 10.5, fontWeight: 800, color: '#b45309', background: '#fef3c7', borderRadius: 6, padding: '3px 8px' }}>
            저장 안 됨
          </span>
        )}
        <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: 13, fontWeight: 800 }}>{open ? '▲ 접기' : '▼ 펼치기'}</span>
      </button>
      {/* 접혀도 unmount 금지 — 미저장 편집 보존 */}
      <div style={{ display: open ? 'block' : 'none', paddingTop: 12 }}>{children}</div>
    </section>
  );
}

// ═══ 배치도 섹션 ═══

function LayoutSection({ spotId, onDirtyChange }: { spotId: string; onDirtyChange: (d: boolean) => void }) {
  const [zones, setZones] = useState<EditorZone[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [spot, setSpot] = useState<{ name: string; slug: string } | null>(null);
  const [tool, setTool] = useState<Tool>('seat');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'all' | string | null>(null);
  const [dirtyZones, setDirtyZones] = useState<Set<string>>(new Set());
  const [globalDirty, setGlobalDirty] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const savedRef = useRef<EditorZone[]>([]);

  const anyDirty = dirtyZones.size > 0 || globalDirty;
  useEffect(() => {
    onDirtyChange(anyDirty);
  }, [anyDirty, onDirtyChange]);

  useEffect(() => {
    fetch(`/api/partner/spots/${spotId}/tables`)
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
            seats: (z.seats ?? []).map((s) => ({ label: s.label, row: s.row, col: s.col, seat_type: s.seat_type })),
          }),
        );
        setZones(loaded);
        savedRef.current = clone(loaded);
      })
      .finally(() => setLoading(false));
  }, [spotId]);

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
    setZones((prev) => [...prev, { key, name: `구역 ${prev.length + 1}`, grid_rows: 4, grid_cols: 7, seats: [] }]);
    markZone(key);
  };

  const payload = (list: EditorZone[]) =>
    list.map((z) => ({ name: z.name, grid_rows: z.grid_rows, grid_cols: z.grid_cols, seats: z.seats }));

  const put = async (body: object) => {
    const res = await fetch(`/api/partner/spots/${spotId}/tables`, {
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

  if (loading) return <Spinner label="배치도 불러오는 중…" />;

  const seatCount = zones.reduce((acc, z) => acc + z.seats.filter((s) => s.seat_type === 'seat').length, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 서비스 on/off + 미리보기 */}
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
          <span style={{ fontWeight: 600, fontSize: 11.5, color: '#9ca3af' }}>(전체 저장 시 반영)</span>
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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={saveAll}
          disabled={saving !== null || !anyDirty}
          style={{ ...buttonStyle('primary', { disabled: saving !== null || !anyDirty }), height: 40, padding: '0 18px', fontSize: 13 }}
        >
          {saving === 'all' ? '저장 중…' : anyDirty ? '배치도 전체 저장' : '저장됨'}
        </button>
        <Link href={`/partner/spot/${spotId}/tables/qr`} style={{ ...buttonStyle('outline'), height: 40, padding: '0 14px', fontSize: 12.5 }}>
          🖨 QR 인쇄 →
        </Link>
        <button onClick={renumber} style={{ ...buttonStyle('outline'), height: 40, padding: '0 14px', fontSize: 12.5, marginLeft: 'auto' }}>
          번호 다시 매기기
        </button>
      </div>

      <span style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 600, margin: '0 2px' }}>
        좌석 {seatCount}개 · 구역 이름 옆 ▼를 눌러 접고 펼칠 수 있어요
      </span>

      {zones.map((z) => {
        const zDirty = dirtyZones.has(z.key);
        const zCollapsed = collapsed.has(z.key);
        const zSeatCount = z.seats.filter((s) => s.seat_type === 'seat').length;
        return (
          <Card key={z.key} style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() =>
                  setCollapsed((prev) => {
                    const next = new Set(prev);
                    if (next.has(z.key)) next.delete(z.key);
                    else next.add(z.key);
                    return next;
                  })
                }
                style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 12, fontWeight: 800, cursor: 'pointer', lineHeight: 1 }}
              >
                {zCollapsed ? '▼' : '▲'}
              </button>
              <input
                value={z.name}
                onChange={(e) => mutateZone(z.key, (zz) => ({ ...zz, name: e.target.value }))}
                maxLength={20}
                style={{ width: 130, height: 38, padding: '0 12px', borderRadius: 9, border: '1px solid #e5e7eb', fontSize: 13.5, fontWeight: 700, color: '#111827', outline: 'none' }}
              />
              {zCollapsed ? (
                <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 700 }}>좌석 {zSeatCount}개</span>
              ) : (
                <>
                  <GridStepper
                    label="행"
                    value={z.grid_rows}
                    min={1}
                    max={20}
                    onChange={(v) => mutateZone(z.key, (zz) => ({ ...zz, grid_rows: v, seats: zz.seats.filter((s) => s.row < v) }))}
                  />
                  <GridStepper
                    label="열"
                    value={z.grid_cols}
                    min={1}
                    max={12}
                    onChange={(v) => mutateZone(z.key, (zz) => ({ ...zz, grid_cols: v, seats: zz.seats.filter((s) => s.col < v) }))}
                  />
                </>
              )}
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
                    if (!confirm(`'${z.name}' 구역을 삭제할까요?\n삭제는 [배치도 전체 저장]을 눌러야 최종 반영돼요.`)) return;
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

            {!zCollapsed && (
              <>
                {/* 구역별 도구 팔레트 */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0 10px' }}>
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
                          style={{ aspectRatio: '1', borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: 'pointer', ...cellStyle(seat?.seat_type) }}
                        >
                          {seat?.seat_type === 'block' ? '' : seat?.label ?? ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
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
      <TablesHub />
    </AuthGate>
  );
}

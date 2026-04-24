'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface AdminSpot {
  id: string;
  name: string;
  slug: string;
  region: string;
  category: string;
  address: string;
  instagram_id: string | null;
  lat: number;
  lng: number;
  created_at: string;
}

export default function AdminSpotsPage() {
  const [spots, setSpots] = useState<AdminSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<AdminSpot | null>(null);

  async function reload() {
    setLoading(true);
    const res = await fetch('/api/admin/spots');
    setSpots(res.ok ? await res.json() : []);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleDelete(spot: AdminSpot) {
    if (!confirm(`"${spot.name}" 정말 삭제할까요? 연결된 스토리·댓글도 함께 사라집니다.`)) return;
    const res = await fetch(`/api/admin/spots/${spot.id}`, { method: 'DELETE' });
    if (!res.ok) {
      alert('삭제 실패');
      return;
    }
    reload();
  }

  const filtered = spots.filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) ||
      s.slug.toLowerCase().includes(q) ||
      (s.instagram_id ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold" style={{ color: '#111827' }}>
          가게 관리 ({spots.length})
        </h1>
        <Link
          href="/admin/spots/new"
          className="px-3 py-1.5 text-xs font-medium"
          style={{
            background: '#111827',
            color: '#fff',
            borderRadius: 8,
            textDecoration: 'none',
          }}
        >
          + 새 가게
        </Link>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="가게명·slug·인스타 검색"
        className="w-full"
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: '8px 11px',
          fontSize: 13,
          background: '#ffffff',
          outline: 'none',
        }}
      />

      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div className="p-6 text-center text-xs" style={{ color: '#9ca3af' }}>
            불러오는 중…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-xs" style={{ color: '#9ca3af' }}>
            결과가 없습니다
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: '#f8f9fa' }}>
                <Th>가게명</Th>
                <Th>slug</Th>
                <Th>지역</Th>
                <Th>종류</Th>
                <Th>IG</Th>
                <Th align="right">액션</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <tr
                  key={s.id}
                  style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}
                >
                  <Td strong>{s.name}</Td>
                  <Td mono>{s.slug}</Td>
                  <Td>{s.region}</Td>
                  <Td>{s.category === 'bar' ? '혼술바' : '게하'}</Td>
                  <Td mono>{s.instagram_id || '-'}</Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditing(s)}
                        style={{
                          background: 'transparent',
                          color: '#374151',
                          border: '1px solid #e5e7eb',
                          borderRadius: 6,
                          padding: '3px 8px',
                        }}
                      >
                        수정
                      </button>
                      <button
                        onClick={() => handleDelete(s)}
                        style={{
                          background: 'transparent',
                          color: '#dc2626',
                          border: '1px solid #fecaca',
                          borderRadius: 6,
                          padding: '3px 8px',
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <SpotEditDrawer
          spot={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'right' }) {
  return (
    <th
      className="px-3 py-2"
      style={{
        textAlign: align || 'left',
        fontWeight: 600,
        color: '#6b7280',
        fontSize: 11,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  strong,
  mono,
}: {
  children: React.ReactNode;
  align?: 'right';
  strong?: boolean;
  mono?: boolean;
}) {
  return (
    <td
      className="px-3 py-2"
      style={{
        textAlign: align || 'left',
        color: strong ? '#111827' : '#374151',
        fontWeight: strong ? 600 : 400,
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
      }}
    >
      {children}
    </td>
  );
}

function SpotEditDrawer({
  spot,
  onClose,
  onSaved,
}: {
  spot: AdminSpot;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ ...spot, instagram_id: spot.instagram_id ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/spots/${spot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || '저장 실패');
      }
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white"
        style={{ borderRadius: 14, maxHeight: '90dvh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-2 flex items-center justify-between">
          <h2 className="font-bold" style={{ color: '#111827', fontSize: 15 }}>
            가게 수정
          </h2>
          <button onClick={onClose} style={{ color: '#9ca3af' }}>
            ✕
          </button>
        </div>
        <div className="px-5 pb-5 space-y-2">
          <F label="가게명">
            <In value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          </F>
          <F label="slug (URL)">
            <In value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} mono />
          </F>
          <div className="grid grid-cols-2 gap-2">
            <F label="지역">
              <Sel
                value={form.region}
                onChange={(v) => setForm({ ...form, region: v })}
                options={['jeju', 'aewol', 'seogwipo', 'east', 'west']}
              />
            </F>
            <F label="종류">
              <Sel
                value={form.category}
                onChange={(v) => setForm({ ...form, category: v })}
                options={['bar', 'guesthouse']}
              />
            </F>
          </div>
          <F label="주소">
            <In value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          </F>
          <div className="grid grid-cols-2 gap-2">
            <F label="위도 (lat)">
              <In
                value={String(form.lat)}
                onChange={(v) => setForm({ ...form, lat: Number(v) })}
              />
            </F>
            <F label="경도 (lng)">
              <In
                value={String(form.lng)}
                onChange={(v) => setForm({ ...form, lng: Number(v) })}
              />
            </F>
          </div>
          <F label="인스타그램 계정 (@ 제외)">
            <In
              value={form.instagram_id}
              onChange={(v) => setForm({ ...form, instagram_id: v })}
              mono
            />
          </F>
          {error && <div style={{ color: '#dc2626', fontSize: 12 }}>{error}</div>}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2"
              style={{
                background: '#f3f4f6',
                color: '#374151',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              취소
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 py-2"
              style={{
                background: saving ? '#9ca3af' : '#111827',
                color: '#fff',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3, fontWeight: 500 }}>
        {label}
      </div>
      {children}
    </label>
  );
}

function In({
  value,
  onChange,
  mono,
}: {
  value: string;
  onChange: (v: string) => void;
  mono?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full"
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 13,
        outline: 'none',
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
      }}
    />
  );
}

const VALUE_LABELS: Record<string, string> = {
  jeju: '제주시',
  aewol: '애월',
  seogwipo: '서귀포',
  east: '동부',
  west: '서부',
  bar: '혼술바',
  guesthouse: '게스트하우스',
};

function Sel({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              background: active ? '#111827' : '#ffffff',
              color: active ? '#ffffff' : '#6b7280',
              border: '1px solid',
              borderColor: active ? '#111827' : '#e5e7eb',
            }}
          >
            {VALUE_LABELS[o] || o}
          </button>
        );
      })}
    </div>
  );
}

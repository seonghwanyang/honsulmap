'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSlug } from '@/lib/utils';

interface SpotRequest {
  id: string;
  name: string;
  ig_handle: string | null;
  region: string;
  category: string;
  address: string | null;
  note: string | null;
}

function NewSpotInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromRequest = searchParams.get('from_request');

  const [form, setForm] = useState({
    name: '',
    slug: '',
    region: 'jeju',
    category: 'bar',
    address: '',
    lat: '',
    lng: '',
    instagram_id: '',
    naver_place_id: '',
    phone: '',
    business_hours: '',
    memo: '',
  });
  const [slugDirty, setSlugDirty] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Prefill from pending spot_request
  useEffect(() => {
    if (!fromRequest) return;
    (async () => {
      const res = await fetch(`/api/admin/spot-requests`);
      if (!res.ok) return;
      const all: SpotRequest[] = await res.json();
      const match = all.find((r) => r.id === fromRequest);
      if (!match) return;
      setForm((prev) => ({
        ...prev,
        name: match.name,
        slug: prev.slug || createSlug(match.name),
        region: match.region,
        category: match.category,
        address: match.address || '',
        instagram_id: match.ig_handle || '',
        memo: match.note ? `요청 메모: ${match.note}` : '',
      }));
    })();
  }, [fromRequest]);

  async function submit() {
    setError('');
    if (!form.name.trim()) return setError('가게명이 필요합니다.');
    if (!form.slug.trim()) return setError('slug가 필요합니다.');
    if (!form.address.trim()) return setError('주소가 필요합니다.');
    if (!form.lat || !form.lng) return setError('좌표가 필요합니다.');

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/spots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          lat: Number(form.lat),
          lng: Number(form.lng),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || '등록 실패');
      }
      const spot = await res.json();

      // Mark the request as approved and link it to the new spot
      if (fromRequest) {
        await fetch(`/api/admin/spot-requests/${fromRequest}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'approved',
            created_spot_id: spot.id,
          }),
        });
      }

      router.push('/admin/spots');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-xl font-bold" style={{ color: '#111827' }}>
        새 가게 등록
      </h1>

      {fromRequest && (
        <div
          style={{
            background: '#f8f9fa',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: 10,
            fontSize: 12,
            color: '#6b7280',
          }}
        >
          이용자 요청 #{fromRequest.slice(0, 8)}을 승인하는 중입니다. 등록이 완료되면 요청 상태가
          자동으로 &quot;approved&quot;로 바뀝니다.
        </div>
      )}

      <div
        className="bg-white p-4 space-y-3"
        style={{ border: '1px solid #e5e7eb', borderRadius: 10 }}
      >
        <Row label="가게명 *">
          <Input
            value={form.name}
            onChange={(v) =>
              setForm((prev) => ({
                ...prev,
                name: v,
                slug: slugDirty ? prev.slug : createSlug(v),
              }))
            }
          />
        </Row>
        <Row
          label="slug *"
          hint="URL에 쓰이는 영문·숫자·한글·하이픈. 가게명에서 자동 생성되며 직접 수정도 가능합니다."
        >
          <Input
            value={form.slug}
            onChange={(v) => {
              setSlugDirty(true);
              setForm({ ...form, slug: v });
            }}
            mono
          />
        </Row>
        <div className="grid grid-cols-2 gap-2">
          <Row label="지역 *">
            <Select
              value={form.region}
              onChange={(v) => setForm({ ...form, region: v })}
              options={[
                ['jeju', '제주시'],
                ['aewol', '애월'],
                ['seogwipo', '서귀포'],
                ['east', '동부'],
                ['west', '서부'],
              ]}
            />
          </Row>
          <Row label="종류 *">
            <Select
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
              options={[
                ['bar', '혼술바'],
                ['guesthouse', '게스트하우스'],
              ]}
            />
          </Row>
        </div>
        <Row label="주소 *">
          <Input value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
        </Row>
        <div className="grid grid-cols-2 gap-2">
          <Row label="위도 (lat) *">
            <Input value={form.lat} onChange={(v) => setForm({ ...form, lat: v })} />
          </Row>
          <Row label="경도 (lng) *">
            <Input value={form.lng} onChange={(v) => setForm({ ...form, lng: v })} />
          </Row>
        </div>
        <Row label="인스타그램 계정 (@ 제외)">
          <Input
            value={form.instagram_id}
            onChange={(v) => setForm({ ...form, instagram_id: v })}
            mono
          />
        </Row>
        <Row label="네이버 place id">
          <Input
            value={form.naver_place_id}
            onChange={(v) => setForm({ ...form, naver_place_id: v })}
            mono
          />
        </Row>
        <Row label="전화">
          <Input value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        </Row>
        <Row label="영업시간">
          <Input
            value={form.business_hours}
            onChange={(v) => setForm({ ...form, business_hours: v })}
          />
        </Row>
        <Row label="메모">
          <Textarea value={form.memo} onChange={(v) => setForm({ ...form, memo: v })} />
        </Row>

        {error && <div style={{ color: '#dc2626', fontSize: 12 }}>{error}</div>}

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full py-2.5"
          style={{
            background: submitting ? '#9ca3af' : '#111827',
            color: '#fff',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {submitting ? '등록 중…' : '등록'}
        </button>
      </div>
    </div>
  );
}

export default function NewSpotPage() {
  return (
    <Suspense fallback={<div style={{ fontSize: 12, color: '#9ca3af' }}>불러오는 중…</div>}>
      <NewSpotInner />
    </Suspense>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{label}</div>
      {hint && (
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1, marginBottom: 4 }}>
          {hint}
        </div>
      )}
      {children}
    </label>
  );
}

function Input({
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
        marginTop: 3,
        fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
      }}
    />
  );
}

function Textarea({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={2}
      className="w-full resize-none"
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '8px 10px',
        fontSize: 13,
        outline: 'none',
        marginTop: 3,
      }}
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <div className="flex flex-wrap gap-1.5" style={{ marginTop: 3 }}>
      {options.map(([v, l]) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
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
            {l}
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AuthGate from '../../AuthGate';
import { Card, Chip, PageHeader, Spinner, buttonStyle } from '../../ui';

interface SpotData {
  role: 'owner' | 'manager';
  spot: {
    id: string;
    name: string;
    slug: string;
    region: string;
    category: string;
    instagram_id: string | null;
    memo: string | null;
    business_hours: string | null;
    phone: string | null;
    vip_until: string | null;
  };
  stats: { views: number; visits: number; likes: number; mood_up: number; mood_down: number };
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 46,
  padding: '0 14px',
  borderRadius: 11,
  border: '1px solid #e5e7eb',
  background: '#fff',
  color: '#111827',
  fontSize: 14,
  outline: 'none',
};
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12.5,
  fontWeight: 700,
  color: '#374151',
  marginBottom: 7,
  letterSpacing: '-0.2px',
};
const sectionLabel: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: '#6b7280',
  letterSpacing: '0.2px',
  margin: '0 2px 10px',
};

function StatBox({ label, value }: { label: string; value: number | string }) {
  return (
    <Card style={{ padding: '15px 14px' }}>
      <div style={{ fontSize: 11.5, color: '#6b7280', fontWeight: 600, letterSpacing: '-0.1px' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginTop: 4, letterSpacing: '-0.6px' }}>
        {value}
      </div>
    </Card>
  );
}

function isVip(until: string | null) {
  return !!until && new Date(until).getTime() > Date.now();
}

function SpotManageContent() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<SpotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [memo, setMemo] = useState('');
  const [hours, setHours] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/partner/spots/${id}`)
      .then(async (r) => {
        if (r.status === 403) {
          setForbidden(true);
          return null;
        }
        return r.ok ? ((await r.json()) as SpotData) : null;
      })
      .then((d) => {
        if (d) {
          setData(d);
          setMemo(d.spot.memo ?? '');
          setHours(d.spot.business_hours ?? '');
          setPhone(d.spot.phone ?? '');
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    setSaving(true);
    setError('');
    setSavedMsg('');
    try {
      const res = await fetch(`/api/partner/spots/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo, business_hours: hours, phone }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || '저장에 실패했어요.');
      }
      setSavedMsg('저장됐어요.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Spinner />;
  }

  if (forbidden || !data) {
    return (
      <Card style={{ padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>
          {forbidden ? '이 가게를 관리할 권한이 없어요.' : '가게 정보를 불러오지 못했어요.'}
        </p>
        <Link href="/partner/dashboard" style={{ ...buttonStyle('outline'), marginTop: 18 }}>
          대시보드로
        </Link>
      </Card>
    );
  }

  const { spot, stats } = data;
  const moodTotal = stats.mood_up + stats.mood_down;
  const upPct = moodTotal > 0 ? Math.round((stats.mood_up / moodTotal) * 100) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {spot.name}
            {isVip(spot.vip_until) && <Chip tone="vip">★ VIP</Chip>}
          </span>
        }
        subtitle={`${spot.region} · ${spot.category === 'guesthouse' ? '게스트하우스' : '혼술바'}${
          spot.instagram_id ? ` · @${spot.instagram_id}` : ''
        }`}
        action={
          <Link href="/partner/dashboard" style={buttonStyle('outline')}>
            ← 대시보드
          </Link>
        }
      />

      {/* Stats */}
      <section>
        <h2 style={sectionLabel}>통계</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 10 }}>
          <StatBox label="조회수" value={stats.views.toLocaleString()} />
          <StatBox label="다녀왔어요" value={stats.visits.toLocaleString()} />
          <StatBox label="좋아요" value={stats.likes.toLocaleString()} />
          <StatBox label="분위기 👍" value={upPct == null ? '—' : `${upPct}%`} />
        </div>
      </section>

      {/* Edit */}
      <section>
        <h2 style={sectionLabel}>가게 정보</h2>
        <Card style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>소개</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="가게 소개를 적어주세요 (최대 500자)"
              style={{ ...inputStyle, height: 'auto', padding: 12, resize: 'none', lineHeight: 1.5 }}
            />
          </div>
          <div>
            <label style={labelStyle}>영업시간</label>
            <input
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              maxLength={100}
              placeholder="예) 매일 18:00 - 02:00"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>전화번호</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={30}
              placeholder="예) 0507-1234-5678"
              style={inputStyle}
            />
          </div>
          <p style={{ fontSize: 11.5, color: '#9ca3af', lineHeight: 1.55 }}>
            가게명 · 위치 · 인스타 계정은 운영자가 관리해요. 변경이 필요하면 contact@higgsi.com 으로 알려주세요.
          </p>
          {error && <p style={{ color: '#ef4444', fontSize: 12.5 }}>{error}</p>}
          {savedMsg && <p style={{ color: '#16a34a', fontSize: 12.5, fontWeight: 600 }}>{savedMsg}</p>}
          <button
            onClick={save}
            disabled={saving}
            style={{ ...buttonStyle('primary', { disabled: saving }), alignSelf: 'flex-start' }}
          >
            {saving ? '저장 중…' : '저장하기'}
          </button>
        </Card>
      </section>
    </div>
  );
}

export default function SpotManagePage() {
  return (
    <AuthGate>
      <SpotManageContent />
    </AuthGate>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getRegionLabel, getCategoryLabel } from '@/lib/utils';

// 혜택 모음 (playbook §1.4) — "지금 쓸 수 있는 혜택, 다 모았어요".
// 거지맵 경유쇼핑 레이아웃 참고: 헤더 + 검색/정렬 + 업종·지역 칩 + 카드 그리드
// + 이용방법 1-2-3 + 유의사항. 카드 탭 → 가게 상세(리딤은 상세/패널에서).

interface BenefitSpot {
  id: string;
  name: string;
  slug: string;
  region: string;
  city: string | null;
  category: string;
  avatar_url: string | null;
  benefit_title: string;
  benefit_detail: string | null;
  benefit_expires_at: string | null;
  benefit_updated_at: string | null;
}

type SortKey = 'deadline' | 'new';

function dday(expires: string | null): string | null {
  if (!expires) return null;
  const days = Math.ceil((new Date(expires).getTime() - Date.now()) / 86400000);
  if (days <= 0) return 'D-DAY';
  return `D-${days}`;
}

export default function BenefitsPage() {
  const [list, setList] = useState<BenefitSpot[] | null>(null);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('deadline');
  const [category, setCategory] = useState<'all' | 'bar' | 'guesthouse'>('all');
  const [city, setCity] = useState<'all' | 'jeju' | 'seoul' | 'etc'>('all');

  useEffect(() => {
    fetch('/api/benefits')
      .then((r) => (r.ok ? r.json() : { benefits: [] }))
      .then((d) => setList(d.benefits ?? []))
      .catch(() => setList([]));
  }, []);

  const filtered = useMemo(() => {
    const all = list ?? [];
    const query = q.trim().toLowerCase();
    const out = all.filter((s) => {
      if (category !== 'all' && s.category !== category) return false;
      if (city === 'jeju' && s.city !== 'jeju') return false;
      if (city === 'seoul' && s.city !== 'seoul') return false;
      if (city === 'etc' && (s.city === 'jeju' || s.city === 'seoul')) return false;
      if (query) {
        const hay = `${s.name} ${s.benefit_title} ${s.benefit_detail ?? ''}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
    return out.sort((a, b) => {
      if (sort === 'deadline') {
        // 마감 임박 먼저, 상시(만료 없음)는 뒤로.
        const ax = a.benefit_expires_at ? new Date(a.benefit_expires_at).getTime() : Infinity;
        const bx = b.benefit_expires_at ? new Date(b.benefit_expires_at).getTime() : Infinity;
        return ax - bx;
      }
      const au = a.benefit_updated_at ? new Date(a.benefit_updated_at).getTime() : 0;
      const bu = b.benefit_updated_at ? new Date(b.benefit_updated_at).getTime() : 0;
      return bu - au;
    });
  }, [list, q, sort, category, city]);

  const counts = useMemo(() => {
    const all = list ?? [];
    return {
      all: all.length,
      bar: all.filter((s) => s.category === 'bar').length,
      guesthouse: all.filter((s) => s.category === 'guesthouse').length,
    };
  }, [list]);

  const chip = (active: boolean): React.CSSProperties => ({
    padding: '7px 12px',
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: active ? 700 : 500,
    background: active ? '#111827' : '#fff',
    color: active ? '#fff' : '#6b7280',
    border: '1px solid',
    borderColor: active ? '#111827' : '#e5e7eb',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ background: '#fafafa', minHeight: '100dvh' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '12px 16px 80px' }}>
        {/* Top bar */}
        <div className="flex items-center gap-2" style={{ height: 48 }}>
          <Link href="/" aria-label="지도로" style={{ color: '#6b7280', display: 'inline-flex', padding: 4 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: '#111827', letterSpacing: '-0.3px' }}>혜택</h1>
        </div>

        {/* Header */}
        <div style={{ padding: '6px 2px 14px' }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: '#ea580c', letterSpacing: 0.5 }}>혼술맵 혜택</p>
          <h2 style={{ fontSize: 21, fontWeight: 800, color: '#111827', letterSpacing: '-0.5px', marginTop: 4, lineHeight: 1.3 }}>
            지금 쓸 수 있는 혜택, 다 모았어요
          </h2>
          <p style={{ fontSize: 13, color: '#6b7280', marginTop: 6, lineHeight: 1.5 }}>
            가게에 가서 <b>혜택 사용하기</b>를 누르고 직원에게 화면만 보여주면 끝나요.
          </p>
        </div>

        {/* Search + sort */}
        <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
          <div className="flex items-center gap-2 flex-1" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 11, padding: '0 12px', height: 42 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.34-4.34" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="가게·혜택 검색"
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13.5, background: 'transparent', color: '#111827' }}
            />
          </div>
          <div className="flex" style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 11, overflow: 'hidden', height: 42 }}>
            {(
              [
                ['deadline', '마감임박순'],
                ['new', '최신순'],
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => setSort(k)}
                style={{ padding: '0 12px', fontSize: 12.5, fontWeight: sort === k ? 700 : 500, background: sort === k ? '#111827' : 'transparent', color: sort === k ? '#fff' : '#6b7280', border: 'none', cursor: 'pointer' }}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Chips */}
        <div className="flex gap-1.5 overflow-x-auto" style={{ paddingBottom: 4, marginBottom: 4 }}>
          <button type="button" onClick={() => setCategory('all')} style={chip(category === 'all')}>전체 {counts.all}</button>
          <button type="button" onClick={() => setCategory('bar')} style={chip(category === 'bar')}>혼술바 {counts.bar}</button>
          <button type="button" onClick={() => setCategory('guesthouse')} style={chip(category === 'guesthouse')}>게하 {counts.guesthouse}</button>
          <span style={{ width: 1, background: '#e5e7eb', margin: '4px 4px' }} />
          <button type="button" onClick={() => setCity('all')} style={chip(city === 'all')}>모든 지역</button>
          <button type="button" onClick={() => setCity('jeju')} style={chip(city === 'jeju')}>제주</button>
          <button type="button" onClick={() => setCity('seoul')} style={chip(city === 'seoul')}>서울</button>
          <button type="button" onClick={() => setCity('etc')} style={chip(city === 'etc')}>그 외</button>
        </div>

        {/* Grid */}
        {list === null ? (
          <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '48px 0' }}>불러오는 중…</p>
        ) : filtered.length === 0 ? (
          <div style={{ background: '#fff', border: '1px dashed #d1d5db', borderRadius: 14, padding: '36px 20px', textAlign: 'center', marginTop: 8 }}>
            <p style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1.6 }}>
              조건에 맞는 혜택이 없어요.
              <br />
              곧 더 많은 가게가 혜택을 올릴 거예요!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2" style={{ gap: 10, marginTop: 6 }}>
            {filtered.map((s) => {
              const d = dday(s.benefit_expires_at);
              return (
                <Link
                  key={s.id}
                  href={`/spot/${s.slug}`}
                  style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: '14px 14px 12px', textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}
                >
                  {d && (
                    <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, fontWeight: 800, color: '#dc2626', background: '#fee2e2', borderRadius: 6, padding: '2px 6px' }}>
                      {d}
                    </span>
                  )}
                  {s.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.avatar_url}
                      alt=""
                      style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: '1px solid #f0f0f0' }}
                    />
                  ) : (
                    <span
                      className="flex items-center justify-center"
                      style={{ width: 40, height: 40, background: '#111827', borderRadius: '50%' }}
                      aria-hidden="true"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 12 20 22 4 22 4 12" />
                        <rect x="2" y="7" width="20" height="5" />
                        <line x1="12" y1="22" x2="12" y2="7" />
                        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
                        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
                      </svg>
                    </span>
                  )}
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: '#111827', lineHeight: 1.35, wordBreak: 'keep-all' }}>
                    {s.benefit_title}
                  </span>
                  <span className="truncate" style={{ fontSize: 12, color: '#374151', fontWeight: 600 }}>{s.name}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>
                    {getRegionLabel(s.region)} · {getCategoryLabel(s.category)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {/* 이용 방법 */}
        <div style={{ marginTop: 24, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', marginBottom: 10 }}>이용 방법</div>
          {(
            [
              ['1', '혜택 확인', '마음에 드는 혜택의 가게를 눌러 확인해요.'],
              ['2', '가게 방문', '가게에 가서 [혜택 사용하기]를 눌러요. 가게 확인을 위해 매장에서만 열려요.'],
              ['3', '직원에게 제시', '사용 화면을 직원에게 보여주면 끝! 방문 기록도 자동으로 남아요.'],
            ] as const
          ).map(([n, t, d]) => (
            <div key={n} className="flex gap-3" style={{ padding: '7px 0' }}>
              <span className="flex-shrink-0 flex items-center justify-center" style={{ width: 22, height: 22, borderRadius: '50%', background: '#111827', color: '#fff', fontSize: 11.5, fontWeight: 800 }}>
                {n}
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{t}</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1, lineHeight: 1.5 }}>{d}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 유의사항 */}
        <div style={{ marginTop: 10, background: '#f8f9fa', border: '1px solid #eceef0', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>사용 전 확인</div>
          <p style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 4, lineHeight: 1.6 }}>
            혜택 내용은 가게 사정에 따라 변경·조기 종료될 수 있어요. 같은 혜택은 1인 1회 사용할 수 있고,
            일부 가게는 직원 확인(PIN) 후 처리돼요.
          </p>
        </div>
      </div>
    </div>
  );
}

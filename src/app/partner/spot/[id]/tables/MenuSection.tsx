'use client';

// 메뉴 편집 섹션 — 테이블 설정 허브(/tables)의 아코디언 안에서 동작.
// 카테고리/품목 직접 CRUD + 네이버 수집 메뉴 임포트 + ₩0 서비스 세트.
// 저장은 이 섹션의 자체 버튼으로 (배치도·퀘스트와 독립).

import { useEffect, useState } from 'react';
import { Card, buttonStyle, PlusIcon, Spinner } from '../../../ui';

type ZeroAction = 'call' | 'recommend' | 'report' | 'gift' | null;
interface EdItem {
  key: string;
  name: string;
  priceStr: string;
  description: string;
  sold_out: boolean;
  zero_action: ZeroAction;
}
interface EdCat {
  key: string;
  name: string;
  items: EdItem[];
}
interface NaverMenu {
  name: string;
  price: string | null;
  description: string | null;
}

let k = 0;
const nk = () => `mk${++k}`;

const ZERO_LABEL: Record<Exclude<ZeroAction, null>, string> = {
  call: '직원 호출',
  recommend: '추천 요청',
  report: '불편 신고',
  gift: '익명 선물',
};

const ZERO_PRESET: EdItem[] = [
  { key: '', name: '직원 호출', priceStr: '0', description: '탭하면 직원이 갈게요', sold_out: false, zero_action: 'call' },
  { key: '', name: '직원에게 추천받기', priceStr: '0', description: '취향을 말해주시면 한 잔 골라드려요', sold_out: false, zero_action: 'recommend' },
  { key: '', name: '그냥 이유없이 한 잔 드리고 싶어요', priceStr: '0', description: '다른 좌석에 익명으로 전달돼요', sold_out: false, zero_action: 'gift' },
  { key: '', name: '불편 신고', priceStr: '0', description: '내용은 사장님만 볼 수 있어요', sold_out: false, zero_action: 'report' },
];

export default function MenuSection({
  spotId,
  onDirtyChange,
}: {
  spotId: string;
  onDirtyChange?: (d: boolean) => void;
}) {
  const [cats, setCats] = useState<EdCat[]>([]);
  const [naverMenus, setNaverMenus] = useState<NaverMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    fetch(`/api/partner/spots/${spotId}/menu`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setNaverMenus(Array.isArray(d.naver_menus) ? d.naver_menus : []);
        setCats(
          (d.categories ?? []).map(
            (c: { name: string; items: { name: string; price: number; description: string | null; sold_out: boolean; zero_action: ZeroAction }[] }) => ({
              key: nk(),
              name: c.name,
              items: c.items.map((it) => ({
                key: nk(),
                name: it.name,
                priceStr: String(it.price),
                description: it.description ?? '',
                sold_out: it.sold_out,
                zero_action: it.zero_action,
              })),
            }),
          ),
        );
      })
      .finally(() => setLoading(false));
  }, [spotId]);

  const mutCat = (key: string, fn: (c: EdCat) => EdCat | null) => {
    setCats((prev) => prev.flatMap((c) => (c.key === key ? (fn(c) ? [fn(c)!] : []) : [c])));
    setDirty(true);
  };
  const mutItem = (catKey: string, itemKey: string, fn: (it: EdItem) => EdItem | null) =>
    mutCat(catKey, (c) => ({
      ...c,
      items: c.items.flatMap((it) => (it.key === itemKey ? (fn(it) ? [fn(it)!] : []) : [it])),
    }));

  const importNaver = () => {
    if (!naverMenus.length) return;
    setCats((prev) => [
      ...prev,
      {
        key: nk(),
        name: '메뉴',
        items: naverMenus.map((m) => ({
          key: nk(),
          name: m.name.slice(0, 60),
          priceStr: String(parseInt((m.price ?? '0').replace(/\D/g, ''), 10) || 0),
          description: (m.description ?? '').slice(0, 200),
          sold_out: false,
          zero_action: null,
        })),
      },
    ]);
    setDirty(true);
  };

  const addZeroPreset = () => {
    setCats((prev) => [
      { key: nk(), name: '서비스', items: ZERO_PRESET.map((z) => ({ ...z, key: nk() })) },
      ...prev,
    ]);
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/partner/spots/${spotId}/menu`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categories: cats.map((c) => ({
          name: c.name,
          items: c.items.map((it) => ({
            name: it.name,
            price: parseInt(it.priceStr, 10) || 0,
            description: it.description || null,
            sold_out: it.sold_out,
            zero_action: it.zero_action,
          })),
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

  if (loading) return <Spinner label="메뉴 불러오는 중…" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {naverMenus.length > 0 && (
          <button onClick={importNaver} style={{ ...buttonStyle('outline'), height: 38, padding: '0 14px', fontSize: 12.5 }}>
            네이버 메뉴 {naverMenus.length}개 가져오기
          </button>
        )}
        <button onClick={addZeroPreset} style={{ ...buttonStyle('outline'), height: 38, padding: '0 14px', fontSize: 12.5 }}>
          ₩0 서비스 세트 추가
        </button>
        <button
          onClick={save}
          disabled={saving || !dirty}
          style={{ ...buttonStyle('primary', { disabled: saving || !dirty }), height: 38, padding: '0 18px', fontSize: 12.5, marginLeft: 'auto' }}
        >
          {saving ? '저장 중…' : dirty ? '메뉴 저장' : '저장됨'}
        </button>
      </div>

      {cats.length === 0 && (
        <Card dashed style={{ padding: '32px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13.5 }}>
          카테고리를 추가하고 메뉴를 채워보세요. 네이버 메뉴 가져오기로 시작하면 편해요.
        </Card>
      )}

      {cats.map((c) => (
        <Card key={c.key} style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <input
              value={c.name}
              onChange={(e) => mutCat(c.key, (cc) => ({ ...cc, name: e.target.value.slice(0, 20) }))}
              style={{ width: 160, height: 40, padding: '0 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, fontWeight: 800, color: '#111827', outline: 'none' }}
            />
            <span style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 600 }}>{c.items.length}개</span>
            <button
              onClick={() => confirm(`'${c.name}' 카테고리를 삭제할까요?`) && mutCat(c.key, () => null)}
              style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              카테고리 삭제
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {c.items.map((it) => (
              <div key={it.key} style={{ border: '1px solid #f0f1f3', borderRadius: 12, padding: 12 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    value={it.name}
                    onChange={(e) => mutItem(c.key, it.key, (x) => ({ ...x, name: e.target.value.slice(0, 60) }))}
                    placeholder="메뉴 이름"
                    style={{ flex: '2 1 180px', height: 40, padding: '0 12px', borderRadius: 9, border: '1px solid #e5e7eb', fontSize: 13.5, fontWeight: 700, color: '#111827', outline: 'none' }}
                  />
                  <input
                    value={it.priceStr}
                    onChange={(e) => mutItem(c.key, it.key, (x) => ({ ...x, priceStr: e.target.value.replace(/\D/g, '').slice(0, 8) }))}
                    placeholder="가격(원)"
                    inputMode="numeric"
                    style={{ flex: '1 1 90px', height: 40, padding: '0 12px', borderRadius: 9, border: '1px solid #e5e7eb', fontSize: 13.5, fontWeight: 700, color: '#111827', outline: 'none', textAlign: 'right' }}
                  />
                </div>
                <input
                  value={it.description}
                  onChange={(e) => mutItem(c.key, it.key, (x) => ({ ...x, description: e.target.value.slice(0, 200) }))}
                  placeholder="설명 (선택)"
                  style={{ width: '100%', height: 36, padding: '0 12px', borderRadius: 9, border: '1px solid #f0f1f3', fontSize: 12.5, color: '#374151', outline: 'none', marginTop: 8 }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 9, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: it.sold_out ? '#dc2626' : '#6b7280', cursor: 'pointer' }}>
                    <input type="checkbox" checked={it.sold_out} onChange={(e) => mutItem(c.key, it.key, (x) => ({ ...x, sold_out: e.target.checked }))} style={{ width: 15, height: 15, accentColor: '#dc2626' }} />
                    품절
                  </label>
                  {it.zero_action && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#7c3aed', background: '#f5f3ff', borderRadius: 6, padding: '3px 8px' }}>
                      ₩0 · {ZERO_LABEL[it.zero_action]}
                    </span>
                  )}
                  <button
                    onClick={() => mutItem(c.key, it.key, () => null)}
                    style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() =>
              mutCat(c.key, (cc) => ({
                ...cc,
                items: [...cc.items, { key: nk(), name: '', priceStr: '', description: '', sold_out: false, zero_action: null }],
              }))
            }
            style={{ ...buttonStyle('outline'), height: 38, padding: '0 14px', fontSize: 12.5, marginTop: 12 }}
          >
            <PlusIcon size={14} />
            메뉴 추가
          </button>
        </Card>
      ))}

      <button
        onClick={() => {
          setCats((prev) => [...prev, { key: nk(), name: `카테고리 ${prev.length + 1}`, items: [] }]);
          setDirty(true);
        }}
        style={{ ...buttonStyle('outline'), alignSelf: 'flex-start', height: 40, fontSize: 13 }}
      >
        <PlusIcon />
        카테고리 추가
      </button>
    </div>
  );
}

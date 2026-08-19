'use client';

// 메뉴 편집 섹션 — 테이블 설정 허브(/tables)의 아코디언 안에서 동작.
// 카테고리/품목 직접 CRUD + 네이버 수집 메뉴 임포트 + ₩0 서비스 세트.
//
// 저장은 배치도와 같은 이원화:
//  · [카테고리 저장]   — 그 카테고리만 반영 (마지막 저장 스냅샷 + 교체 전송)
//  · [메뉴 전체 저장]  — 현재 화면 전체 확정. 카테고리 삭제는 여기서만.

import { useEffect, useRef, useState } from 'react';
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
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

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
  // saving: 'all' 또는 저장 중인 카테고리 key
  const [saving, setSaving] = useState<'all' | string | null>(null);
  const [dirtyCats, setDirtyCats] = useState<Set<string>>(new Set());
  const [globalDirty, setGlobalDirty] = useState(false);
  // 서버에 저장돼 있는 상태의 스냅샷 — 카테고리별 저장의 기준점
  const savedRef = useRef<EdCat[]>([]);

  const anyDirty = dirtyCats.size > 0 || globalDirty;
  useEffect(() => {
    onDirtyChange?.(anyDirty);
  }, [anyDirty, onDirtyChange]);

  useEffect(() => {
    fetch(`/api/partner/spots/${spotId}/menu`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setNaverMenus(Array.isArray(d.naver_menus) ? d.naver_menus : []);
        const loaded: EdCat[] = (d.categories ?? []).map(
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
        );
        setCats(loaded);
        savedRef.current = clone(loaded);
      })
      .finally(() => setLoading(false));
  }, [spotId]);

  const markCat = (key: string) => setDirtyCats((prev) => new Set(prev).add(key));

  const mutCat = (key: string, fn: (c: EdCat) => EdCat) => {
    setCats((prev) => prev.map((c) => (c.key === key ? fn(c) : c)));
    markCat(key);
  };
  const mutItem = (catKey: string, itemKey: string, fn: (it: EdItem) => EdItem | null) =>
    mutCat(catKey, (c) => ({
      ...c,
      items: c.items.flatMap((it) => (it.key === itemKey ? (fn(it) ? [fn(it)!] : []) : [it])),
    }));

  const delCat = (key: string, name: string) => {
    if (!confirm(`'${name}' 카테고리를 삭제할까요?\n삭제는 [메뉴 전체 저장]을 눌러야 최종 반영돼요.`)) return;
    setCats((prev) => prev.filter((c) => c.key !== key));
    setDirtyCats((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    setGlobalDirty(true);
  };

  const addCat = (cat: EdCat) => {
    setCats((prev) => [...prev, cat]);
    markCat(cat.key);
  };

  const importNaver = () => {
    if (!naverMenus.length) return;
    addCat({
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
    });
  };

  const addZeroPreset = () => {
    const cat = { key: nk(), name: '서비스', items: ZERO_PRESET.map((z) => ({ ...z, key: nk() })) };
    setCats((prev) => [cat, ...prev]);
    markCat(cat.key);
  };

  const payload = (list: EdCat[]) =>
    list.map((c) => ({
      name: c.name,
      items: c.items.map((it) => ({
        name: it.name,
        price: parseInt(it.priceStr, 10) || 0,
        description: it.description || null,
        sold_out: it.sold_out,
        zero_action: it.zero_action,
      })),
    }));

  const put = async (body: object) => {
    const res = await fetch(`/api/partner/spots/${spotId}/menu`, {
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

  // 전체 저장 — 삭제 포함 현재 화면 그대로 확정
  const saveAll = async () => {
    setSaving('all');
    const ok = await put({ categories: payload(cats) });
    setSaving(null);
    if (!ok) return;
    savedRef.current = clone(cats);
    setDirtyCats(new Set());
    setGlobalDirty(false);
  };

  // 카테고리 저장 — 스냅샷에서 이 카테고리만 교체 (다른 미저장 변경 미포함)
  const saveCat = async (key: string) => {
    const cat = cats.find((c) => c.key === key);
    if (!cat) return;
    const base = clone(savedRef.current);
    const idx = base.findIndex((c) => c.key === key);
    if (idx >= 0) base[idx] = clone(cat);
    else base.push(clone(cat));
    setSaving(key);
    const ok = await put({ categories: payload(base) });
    setSaving(null);
    if (!ok) return;
    savedRef.current = base;
    setDirtyCats((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
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
          onClick={saveAll}
          disabled={saving !== null || !anyDirty}
          style={{ ...buttonStyle('primary', { disabled: saving !== null || !anyDirty }), height: 38, padding: '0 18px', fontSize: 12.5, marginLeft: 'auto' }}
        >
          {saving === 'all' ? '저장 중…' : anyDirty ? '메뉴 전체 저장' : '저장됨'}
        </button>
      </div>

      {cats.length === 0 && (
        <Card dashed style={{ padding: '32px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13.5 }}>
          카테고리를 추가하고 메뉴를 채워보세요. 네이버 메뉴 가져오기로 시작하면 편해요.
        </Card>
      )}

      {cats.map((c) => {
        const cDirty = dirtyCats.has(c.key);
        return (
          <Card key={c.key} style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <input
                value={c.name}
                onChange={(e) => mutCat(c.key, (cc) => ({ ...cc, name: e.target.value.slice(0, 20) }))}
                style={{ width: 150, height: 40, padding: '0 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, fontWeight: 800, color: '#111827', outline: 'none' }}
              />
              <span style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 600 }}>{c.items.length}개</span>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={() => saveCat(c.key)}
                  disabled={saving !== null || !cDirty}
                  style={{ height: 34, padding: '0 16px', borderRadius: 9, fontSize: 12, fontWeight: 800, border: 'none', background: cDirty ? '#111827' : '#f3f4f6', color: cDirty ? '#fff' : '#9ca3af', cursor: cDirty && saving === null ? 'pointer' : 'default' }}
                >
                  {saving === c.key ? '저장 중…' : cDirty ? '카테고리 저장' : '저장됨'}
                </button>
                <button
                  onClick={() => delCat(c.key, c.name)}
                  style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  카테고리 삭제
                </button>
              </div>
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
        );
      })}

      <button
        onClick={() => addCat({ key: nk(), name: `카테고리 ${cats.length + 1}`, items: [] })}
        style={{ ...buttonStyle('outline'), alignSelf: 'flex-start', height: 40, fontSize: 13 }}
      >
        <PlusIcon />
        카테고리 추가
      </button>
    </div>
  );
}

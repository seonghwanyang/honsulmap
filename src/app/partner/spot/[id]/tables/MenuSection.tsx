'use client';

// 메뉴 편집 섹션 — 테이블 설정 허브(/tables)의 아코디언 안에서 동작.
// 카테고리/품목 직접 CRUD + 네이버 수집 메뉴 임포트 + ₩0 서비스 세트.
//
// 저장은 배치도와 같은 이원화:
//  · [카테고리 저장]   — 그 카테고리만 반영 (마지막 저장 스냅샷 + 교체 전송)
//  · [메뉴 전체 저장]  — 현재 화면 전체 확정. 카테고리 삭제는 여기서만.

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, buttonStyle, PlusIcon, Spinner } from '../../../ui';

type ZeroAction = 'call' | 'recommend' | 'report' | 'gift' | null;
interface EdItem {
  key: string;
  name: string;
  priceStr: string;
  description: string;
  sold_out: boolean;
  zero_action: ZeroAction;
  image_url?: string | null; // 손님 메뉴판 썸네일 (post-images 버킷)
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
  { key: '', name: '자리 바꿔주세요', priceStr: '0', description: '직원이 가면 원하는 자리를 말씀해주세요', sold_out: false, zero_action: 'call' },
  { key: '', name: '직원에게 추천받기', priceStr: '0', description: '취향을 말해주시면 한 잔 골라드려요', sold_out: false, zero_action: 'recommend' },
  { key: '', name: '그냥 이유없이 한 잔 드리고 싶어요', priceStr: '0', description: '다른 좌석에 익명으로 전달돼요', sold_out: false, zero_action: 'gift' },
  { key: '', name: '진상 신고', priceStr: '0', description: '사장님만 볼 수 있어요. 조용히 도와드릴게요', sold_out: false, zero_action: 'report' },
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
  const [tossOn, setTossOn] = useState(false); // 토스 포스 연동 가게 — 가져오기 버튼 노출
  const [tossBusy, setTossBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  // saving: 'all' 또는 저장 중인 카테고리 key
  const [saving, setSaving] = useState<'all' | string | null>(null);
  const [dirtyCats, setDirtyCats] = useState<Set<string>>(new Set());
  const [globalDirty, setGlobalDirty] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // 서버에 저장돼 있는 상태의 스냅샷 — 카테고리별 저장의 기준점
  const savedRef = useRef<EdCat[]>([]);

  const toggleCat = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // ── 카테고리 드래그 정렬 — 헤더의 ≡ 핸들을 잡고 위아래로. 접힘/펼침 모두 동작.
  // 포인터가 이웃 카드의 중간선을 넘으면 즉시 자리 교환(라이브 리오더).
  // 순서는 [메뉴 전체 저장]으로 확정된다 (PUT이 배열 순서를 sort로 저장).
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dragRef = useRef<{ key: string; moved: boolean } | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);

  const onDragStart = (e: React.PointerEvent, key: string) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { key, moved: false };
    setDragKey(key);
  };
  const onDragMove = (e: React.PointerEvent) => {
    const st = dragRef.current;
    if (!st) return;
    const y = e.clientY;
    // 화면 가장자리 근처면 페이지 자동 스크롤 (긴 목록 이동용)
    if (y < 90) window.scrollBy(0, -14);
    else if (y > window.innerHeight - 90) window.scrollBy(0, 14);
    setCats((prev) => {
      const from = prev.findIndex((c) => c.key === st.key);
      if (from < 0) return prev;
      const trySwap = (dir: -1 | 1) => {
        const neighbor = prev[from + dir];
        if (!neighbor) return null;
        const el = cardRefs.current.get(neighbor.key);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const mid = r.top + r.height / 2;
        if ((dir === -1 && y < mid) || (dir === 1 && y > mid)) {
          st.moved = true;
          const next = [...prev];
          next.splice(from, 1);
          next.splice(from + dir, 0, prev[from]);
          return next;
        }
        return null;
      };
      return trySwap(-1) ?? trySwap(1) ?? prev;
    });
  };
  const onDragEnd = () => {
    const st = dragRef.current;
    if (!st) return;
    dragRef.current = null;
    setDragKey(null);
    if (st.moved) setGlobalDirty(true); // 순서 변경은 [메뉴 전체 저장]으로 확정
  };

  // ── 품목 드래그 정렬 — 같은 카테고리 안에서 위아래로. 카테고리와 동일 패턴.
  // 품목 순서는 [카테고리 저장]만으로도 확정된다 (카테고리 통째 교체 저장이라).
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const itemDragRef = useRef<{ catKey: string; itemKey: string; moved: boolean } | null>(null);
  const [dragItemKey, setDragItemKey] = useState<string | null>(null);

  const onItemDragStart = (e: React.PointerEvent, catKey: string, itemKey: string) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    itemDragRef.current = { catKey, itemKey, moved: false };
    setDragItemKey(itemKey);
  };
  const onItemDragMove = (e: React.PointerEvent) => {
    const st = itemDragRef.current;
    if (!st) return;
    const y = e.clientY;
    if (y < 90) window.scrollBy(0, -14);
    else if (y > window.innerHeight - 90) window.scrollBy(0, 14);
    setCats((prev) =>
      prev.map((c) => {
        if (c.key !== st.catKey) return c;
        const from = c.items.findIndex((it) => it.key === st.itemKey);
        if (from < 0) return c;
        const trySwap = (dir: -1 | 1) => {
          const neighbor = c.items[from + dir];
          if (!neighbor) return null;
          const el = itemRefs.current.get(neighbor.key);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const mid = r.top + r.height / 2;
          if ((dir === -1 && y < mid) || (dir === 1 && y > mid)) {
            st.moved = true;
            const items = [...c.items];
            items.splice(from, 1);
            items.splice(from + dir, 0, c.items[from]);
            return { ...c, items };
          }
          return null;
        };
        return trySwap(-1) ?? trySwap(1) ?? c;
      }),
    );
  };
  const onItemDragEnd = () => {
    const st = itemDragRef.current;
    if (!st) return;
    itemDragRef.current = null;
    setDragItemKey(null);
    if (st.moved) markCat(st.catKey);
  };

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
        setTossOn(!!d.toss_connected);
        const loaded: EdCat[] = (d.categories ?? []).map(
          (c: { name: string; items: { name: string; price: number; description: string | null; sold_out: boolean; zero_action: ZeroAction; image_url?: string | null }[] }) => ({
            key: nk(),
            name: c.name,
            items: c.items.map((it) => ({
              key: nk(),
              name: it.name,
              priceStr: String(it.price),
              description: it.description ?? '',
              sold_out: it.sold_out,
              zero_action: it.zero_action,
              image_url: it.image_url ?? null,
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

  // 메뉴 사진 업로드 — post-images 버킷 재사용 (커뮤니티 글 업로드와 동일 정책, 5MB 제한)
  const uploadItemImage = async (catKey: string, itemKey: string, file: File) => {
    if (!file.type.startsWith('image/')) return alert('이미지 파일만 올릴 수 있어요.');
    if (file.size > 5 * 1024 * 1024) return alert('이미지는 5MB 이하로 올려주세요.');
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().slice(0, 5);
    const path = `menu/${spotId}/${itemKey}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('post-images')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) return alert(`업로드 실패: ${error.message}`);
    const { data } = supabase.storage.from('post-images').getPublicUrl(path);
    mutItem(catKey, itemKey, (x) => ({ ...x, image_url: data.publicUrl }));
  };

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

  // 토스 포스 카탈로그 동기화 — 같은 이름 카테고리는 포스 기준(순서·가격·구성)으로
  // 교체하고, 포스에 없는 카테고리(₩0 서비스 세트 등 혼술맵 전용)는 그대로 둔다.
  // 교체 시 품절 표시는 품목 이름 기준으로 보존 (영업 중 켜둔 품절이 날아가면 사고).
  const importToss = async () => {
    if (tossBusy) return;
    if (
      !confirm(
        '포스 메뉴로 동기화할까요?\n같은 이름의 카테고리는 포스의 순서·가격·구성으로 교체돼요 (품절·사진·직접 쓴 설명은 유지).\n포스에 없는 카테고리(₩0 서비스 등)는 그대로 둡니다.',
      )
    )
      return;
    setTossBusy(true);
    const res = await fetch(`/api/partner/spots/${spotId}/toss-catalog`);
    setTossBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return alert(d.error || '토스 메뉴를 불러오지 못했어요.');
    const categories: { name: string; items: { name: string; price: number; description: string | null }[] }[] = d.categories ?? [];
    if (!categories.length) return alert('가져올 판매중 메뉴가 없어요.');

    const next = [...cats];
    const touched: string[] = [];
    for (const c of categories) {
      const existing = next.find((x) => x.name.trim() === c.name.trim());
      const prev = new Map((existing?.items ?? []).map((it) => [it.name, it]));
      const items = c.items.map((m) => {
        const p = prev.get(m.name);
        return {
          key: nk(),
          name: m.name,
          priceStr: String(m.price),
          // 직접 써둔 설명(도수 등)·사진·품절은 동기화해도 유지 — 포스엔 없는 정보라
          description: p?.description?.trim() ? p.description : (m.description ?? ''),
          sold_out: p?.sold_out ?? false,
          zero_action: null,
          image_url: p?.image_url ?? null,
        };
      });
      if (existing) {
        next[next.findIndex((x) => x.key === existing.key)] = { ...existing, items };
        touched.push(existing.key);
      } else {
        const cat = { key: nk(), name: c.name, items };
        next.push(cat);
        touched.push(cat.key);
      }
    }
    setCats(next);
    touched.forEach(markCat);
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
        image_url: it.image_url ?? null,
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
        {tossOn && (
          <button onClick={importToss} disabled={tossBusy} style={{ ...buttonStyle('outline'), height: 38, padding: '0 14px', fontSize: 12.5, color: '#2563eb' }}>
            {tossBusy ? '불러오는 중…' : '토스 포스 메뉴 가져오기'}
          </button>
        )}
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
        const cCollapsed = collapsed.has(c.key);
        return (
          <div
            key={c.key}
            ref={(el) => {
              if (el) cardRefs.current.set(c.key, el);
              else cardRefs.current.delete(c.key);
            }}
          >
          <Card style={{ padding: 16, ...(dragKey === c.key ? { outline: '2px solid #111827', boxShadow: '0 10px 28px rgba(0,0,0,0.16)', opacity: 0.95 } : {}) }}>
            {/* 헤더 행 — 빈 공간 어디를 눌러도 접고 펼침 (입력·버튼은 전파 차단) */}
            <div
              onClick={() => toggleCat(c.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: cCollapsed ? 0 : 12, flexWrap: 'wrap', cursor: 'pointer' }}
            >
              {/* ≡ 드래그 핸들 — 잡고 위아래로 끌면 카테고리 순서 변경 */}
              <span
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => onDragStart(e, c.key)}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onPointerCancel={onDragEnd}
                title="끌어서 순서 변경"
                style={{ width: 32, height: 32, display: 'grid', placeItems: 'center', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#9ca3af', fontSize: 16, fontWeight: 800, cursor: dragKey === c.key ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' }}
              >
                ≡
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCat(c.key);
                }}
                style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 12, fontWeight: 800, cursor: 'pointer', lineHeight: 1 }}
              >
                {cCollapsed ? '▼' : '▲'}
              </button>
              <input
                value={c.name}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => mutCat(c.key, (cc) => ({ ...cc, name: e.target.value.slice(0, 20) }))}
                style={{ width: 150, height: 40, padding: '0 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 14, fontWeight: 800, color: '#111827', outline: 'none', cursor: 'text' }}
              />
              <span style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 600 }}>{c.items.length}개</span>
              <div
                onClick={(e) => e.stopPropagation()}
                style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, cursor: 'default' }}
              >
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

            {!cCollapsed && (
            <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {c.items.map((it) => (
                <div
                  key={it.key}
                  ref={(el) => {
                    if (el) itemRefs.current.set(it.key, el);
                    else itemRefs.current.delete(it.key);
                  }}
                  style={{ border: '1px solid #f0f1f3', borderRadius: 12, padding: 12, ...(dragItemKey === it.key ? { outline: '2px solid #111827', boxShadow: '0 8px 20px rgba(0,0,0,0.14)', opacity: 0.95, background: '#fff' } : {}) }}
                >
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {/* 사진 — 탭하면 업로드/교체. 손님 메뉴판에 썸네일로 노출 */}
                    <label title="메뉴 사진" style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 9, border: it.image_url ? '1px solid #e5e7eb' : '1px dashed #d1d5db', background: '#f9fafb', display: 'grid', placeItems: 'center', overflow: 'hidden', cursor: 'pointer' }}>
                      {it.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: 15 }}>📷</span>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (f) void uploadItemImage(c.key, it.key, f);
                        }}
                      />
                    </label>
                    {/* ≡ 품목 드래그 핸들 — 같은 카테고리 안에서 순서 변경 */}
                    <span
                      onPointerDown={(e) => onItemDragStart(e, c.key, it.key)}
                      onPointerMove={onItemDragMove}
                      onPointerUp={onItemDragEnd}
                      onPointerCancel={onItemDragEnd}
                      title="끌어서 순서 변경"
                      style={{ width: 28, height: 40, display: 'grid', placeItems: 'center', color: '#c4c9d0', fontSize: 15, fontWeight: 800, cursor: dragItemKey === it.key ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' }}
                    >
                      ≡
                    </span>
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
                    {it.image_url && (
                      <button
                        onClick={() => mutItem(c.key, it.key, (x) => ({ ...x, image_url: null }))}
                        style={{ fontSize: 11.5, fontWeight: 700, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        사진 제거
                      </button>
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
            </>
            )}
          </Card>
          </div>
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

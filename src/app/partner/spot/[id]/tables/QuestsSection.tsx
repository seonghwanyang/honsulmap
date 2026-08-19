'use client';

// 퀘스트 편집 섹션 — 테이블 설정 허브(/tables)의 아코디언 안에서 동작.
// 템플릿에서 골라 담고 보상만 고치면 끝. 달성 알림은 주문 보드에 뜬다.

import { useEffect, useState } from 'react';
import { Card, buttonStyle, PlusIcon, Spinner } from '../../../ui';

interface EdQuest {
  key: string;
  title: string;
  reward: string;
  hidden: boolean;
  active: boolean;
}

const TEMPLATES: { title: string; reward: string; hidden?: boolean }[] = [
  { title: '시그니처 3잔 도장깨기', reward: '시그니처 1잔 무료' },
  { title: '위스키 3잔 이상 주문하기', reward: '하프샷 추가 증정', hidden: true },
  { title: '혼자 왔어요! 첫 방문 인증', reward: '첫 잔 서비스' },
  { title: 'MBTI 같은 사람 찾기', reward: '레몬드랍 슈터 제공' },
  { title: '칵테일 5종 도장깨기', reward: '칵테일 1잔 추가 증정' },
  { title: '오늘의 안주 주문하기', reward: '서비스 안주 추가' },
  { title: '옆자리와 건배하기', reward: '같이 한 잔 서비스', hidden: true },
  { title: '인스타 스토리에 가게 태그하기', reward: '음료 1잔 서비스' },
];

let k = 0;
const nk = () => `qk${++k}`;

export default function QuestsSection({
  spotId,
  onDirtyChange,
}: {
  spotId: string;
  onDirtyChange?: (d: boolean) => void;
}) {
  const [quests, setQuests] = useState<EdQuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  useEffect(() => {
    fetch(`/api/partner/spots/${spotId}/quests`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setQuests(
          (d.quests ?? []).map((q: { title: string; reward: string; hidden: boolean; active: boolean }) => ({
            key: nk(),
            title: q.title,
            reward: q.reward,
            hidden: q.hidden,
            active: q.active,
          })),
        );
      })
      .finally(() => setLoading(false));
  }, [spotId]);

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/partner/spots/${spotId}/quests`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quests: quests.map(({ key: _k, ...q }) => q) }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || '저장에 실패했어요.');
      return;
    }
    setDirty(false);
  };

  const addTemplate = (t: (typeof TEMPLATES)[number]) => {
    setQuests((prev) => [...prev, { key: nk(), title: t.title, reward: t.reward, hidden: !!t.hidden, active: true }]);
    setDirty(true);
  };

  const mut = (key: string, fn: (q: EdQuest) => EdQuest | null) => {
    setQuests((prev) => prev.flatMap((q) => (q.key === key ? (fn(q) ? [fn(q)!] : []) : [q])));
    setDirty(true);
  };

  if (loading) return <Spinner label="퀘스트 불러오는 중…" />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 600 }}>
          저장하면 오늘 달성 이력이 초기화돼요 — 영업 전에 편집하세요.
        </span>
        <button
          onClick={save}
          disabled={saving || !dirty}
          style={{ ...buttonStyle('primary', { disabled: saving || !dirty }), height: 38, padding: '0 18px', fontSize: 12.5, marginLeft: 'auto' }}
        >
          {saving ? '저장 중…' : dirty ? '퀘스트 저장' : '저장됨'}
        </button>
      </div>

      {quests.length === 0 ? (
        <Card dashed style={{ padding: '28px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13.5 }}>
          아래 템플릿에서 골라 담아보세요. 보상 문구만 바꾸면 바로 시작할 수 있어요.
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {quests.map((q) => (
            <Card key={q.key} style={{ padding: 14, opacity: q.active ? 1 : 0.55 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  value={q.title}
                  onChange={(e) => mut(q.key, (x) => ({ ...x, title: e.target.value.slice(0, 60) }))}
                  placeholder="퀘스트 (예: 시그니처 3잔 도장깨기)"
                  style={{ flex: '2 1 200px', height: 42, padding: '0 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13.5, fontWeight: 700, color: '#111827', outline: 'none' }}
                />
                <input
                  value={q.reward}
                  onChange={(e) => mut(q.key, (x) => ({ ...x, reward: e.target.value.slice(0, 60) }))}
                  placeholder="보상 (예: 하프샷 증정)"
                  style={{ flex: '1 1 140px', height: 42, padding: '0 12px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13.5, color: '#7c3aed', fontWeight: 700, outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#6b7280', cursor: 'pointer' }}>
                  <input type="checkbox" checked={q.hidden} onChange={(e) => mut(q.key, (x) => ({ ...x, hidden: e.target.checked }))} style={{ width: 15, height: 15, accentColor: '#111827' }} />
                  🌙 히든
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#6b7280', cursor: 'pointer' }}>
                  <input type="checkbox" checked={q.active} onChange={(e) => mut(q.key, (x) => ({ ...x, active: e.target.checked }))} style={{ width: 15, height: 15, accentColor: '#111827' }} />
                  활성
                </label>
                <button onClick={() => mut(q.key, () => null)} style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 700, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>
                  삭제
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <button
        onClick={() => {
          setQuests((prev) => [...prev, { key: nk(), title: '', reward: '', hidden: false, active: true }]);
          setDirty(true);
        }}
        style={{ ...buttonStyle('outline'), alignSelf: 'flex-start', height: 40, fontSize: 13 }}
      >
        <PlusIcon size={14} />
        직접 만들기
      </button>

      <section>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: '#6b7280', margin: '4px 2px 10px' }}>템플릿에서 담기</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.title}
              onClick={() => addTemplate(t)}
              style={{ textAlign: 'left', background: '#fff', border: '1px dashed #d1d5db', borderRadius: 12, padding: '12px 14px', cursor: 'pointer' }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: '#111827' }}>
                {t.hidden && '🌙 '}
                {t.title}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', marginTop: 3 }}>→ {t.reward}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

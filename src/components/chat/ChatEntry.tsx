'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUser } from '@/lib/useUser';
import ChatLauncher from '@/components/chat/ChatLauncher';

// 가게별 채팅방(#6) 지도 패널 엔트리(설계 §6.2). MapClient는 이 컴포넌트에
// spotId/spotName만 넘기고, 채팅 상태는 여기가 소유(MapClient 비대화 방지).
//
// 방이 open이면 인라인 '채팅 입장' 대신 플로팅 런처(ChatLauncher)를 띄운다.
// 미개설/닫힘 빈 상태와 사장님 '채팅방 개설' CTA만 패널 안에 남는다.

interface Props {
  spotId: string;
  spotName: string;
  // MapClient 호환용(현재는 ChatRoom/Launcher가 로그인 게이트를 자체 처리). 미사용.
  onNeedLogin?: () => void;
}

type Room = {
  spot_id: string;
  is_open: boolean;
  notice: string | null;
  opened_by: string;
};

export default function ChatEntry({ spotId, spotName }: Props) {
  const { user } = useUser();
  const [room, setRoom] = useState<Room | null>(null);
  const [msgCount, setMsgCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [opening, setOpening] = useState(false);

  // 방 존재/open 조회 — 빈 상태 분기용. spot 바뀌면 재조회.
  useEffect(() => {
    let active = true;
    setLoaded(false);
    fetch(`/api/chat/${spotId}`)
      .then((r) => r.json())
      .then((d) => {
        if (active) {
          setRoom(d.room ?? null);
          setMsgCount(d.message_count ?? 0);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [spotId]);

  // 사장님 판정(UX 분기용 — 서버는 항상 requireMember로 재검증). /api/partner/me
  // 에 이 spot이 있으면 개설 CTA 노출.
  useEffect(() => {
    if (!user) {
      setIsOwner(false);
      return;
    }
    let active = true;
    fetch('/api/partner/me')
      .then((r) => (r.ok ? r.json() : { spots: [] }))
      .then((d: { spots?: { spot?: { id?: string } | null }[] }) => {
        if (!active) return;
        const owns = (d.spots ?? []).some((m) => m.spot?.id === spotId);
        setIsOwner(owns);
      })
      .catch(() => {
        if (active) setIsOwner(false);
      });
    return () => {
      active = false;
    };
  }, [user, spotId]);

  const openRoom = useCallback(async () => {
    if (opening) return;
    setOpening(true);
    try {
      const res = await fetch(`/api/chat/${spotId}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setRoom(data.room);
      }
    } finally {
      setOpening(false);
    }
  }, [spotId, opening]);

  if (!loaded) return null;

  // open — 플로팅 런처. 패널 인라인 UI는 그리지 않는다.
  if (room && room.is_open) {
    return (
      <ChatLauncher
        spotId={spotId}
        spotName={spotName}
        notice={room.notice}
        initialCount={msgCount}
        canModerate={isOwner}
      />
    );
  }

  return (
    <div
      className="mt-3"
      style={{ background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 12, padding: '11px 13px' }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: '#111827' }}>채팅방</span>
      </div>

      {/* 미개설 */}
      {!room && (
        <>
          <p style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.5 }}>
            아직 사장님이 채팅방을 개설하지 않았어요.
          </p>
          {isOwner && (
            <button
              type="button"
              onClick={() => void openRoom()}
              disabled={opening}
              className="mt-2"
              style={{
                background: opening ? '#fdba74' : '#ea580c',
                color: '#fff',
                fontSize: 12.5,
                fontWeight: 700,
                border: 'none',
                borderRadius: 9,
                padding: '8px 14px',
                cursor: opening ? 'default' : 'pointer',
              }}
            >
              {opening ? '개설 중…' : '채팅방 개설'}
            </button>
          )}
        </>
      )}

      {/* 닫힘 */}
      {room && !room.is_open && (
        <p style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.5 }}>사장님이 채팅방을 닫았어요.</p>
      )}
    </div>
  );
}

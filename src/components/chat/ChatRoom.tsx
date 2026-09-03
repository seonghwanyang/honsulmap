'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { useUser } from '@/lib/useUser';
import Image from 'next/image';
import LoginModal from '@/components/LoginModal';
import ReportModal from '@/components/ReportModal';
import { isBlockedNick } from '@/lib/blocklist';
import type { ChatMessage } from '@/lib/types';
import { chatNick, chatAvatar } from '@/lib/chatNick';

// 가게별 채팅방(#6) 방 뷰 — 메시지 리스트 + 입력창 + Realtime 구독.
// MapClient는 ChatEntry를 통해 spotId/spotName/notice만 넘긴다(설계 §6.2).

interface Props {
  spotId: string;
  spotName: string;
  notice: string | null;
  onClose: () => void;
  // 플로팅 윈도우(ChatLauncher)에 박아 쓸 때: 자체 헤더를 숨기고(윈도우가 헤더+닫기를
  // 그림) 높이를 부모에 꽉 채운다. 미지정이면 기존 인라인 동작 그대로.
  embedded?: boolean;
  // 메시지 총수 변동 알림 — 런처 배지를 라이브로 유지(초기 로드/Realtime/전송).
  onCount?: (count: number) => void;
  // 사장님이면 각 메시지에 '삭제' 노출(서버는 requireMember로 재검증).
  canModerate?: boolean;
}

export default function ChatRoom({
  spotId,
  spotName,
  notice,
  onClose,
  embedded = false,
  onCount,
  canModerate = false,
}: Props) {
  const { user, loading: userLoading } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(true);
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);
  const [, forceBlocked] = useState(0); // 차단 시 재렌더로 메시지 숨김 반영

  const listRef = useRef<HTMLDivElement | null>(null);
  // 이미 가진 메시지 id — Realtime 에코/POST 응답 중복 방지.
  const seenRef = useRef<Set<string>>(new Set());
  // user_id → 표시명/프사 캐시(Realtime 미해석 메시지 채우기용).
  const messagesNameCache = useRef<Map<string, string>>(new Map());
  const messagesAvatarCache = useRef<Map<string, ChatMessage['avatar']>>(new Map());

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  // 최신 N개 로드(표시명·사장님 배지 해석은 서버). Realtime로 도착한 미해석
  // 메시지의 이름도 이 GET 재호출로 보강한다.
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/${spotId}/messages`);
      const data = await res.json();
      const list: ChatMessage[] = data.messages ?? [];
      seenRef.current = new Set(list.map((m) => m.id));
      setMessages(list);
    } catch {
      // 무시 — 빈 리스트 유지
    } finally {
      setLoading(false);
    }
  }, [spotId]);

  // 로그인 유저만 메시지를 읽는다(RLS authenticated). 비로그인은 로그인 프롬프트.
  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    void refresh();
  }, [user, userLoading, refresh]);

  useEffect(() => {
    if (!loading) scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  // Realtime 구독 — 이 방의 INSERT만. 로그인 상태에서만(RLS authenticated).
  useEffect(() => {
    if (!user) return;
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`chat:${spotId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `spot_id=eq.${spotId}` },
        (payload) => {
          const row = payload.new as { id: string; user_id: string; body: string; created_at: string };
          if (seenRef.current.has(row.id)) return;
          seenRef.current.add(row.id);
          // 이름/배지는 raw payload에 없음 → 캐시에서 찾고, 없으면 GET으로 보강.
          const knownName = messagesNameCache.current.get(row.user_id);
          const knownAvatar = messagesAvatarCache.current.get(row.user_id);
          setMessages((prev) => [
            ...prev,
            {
              id: row.id,
              user_id: row.user_id,
              body: row.body,
              created_at: row.created_at,
              name: knownName ?? chatNick(row.user_id),
              avatar: knownAvatar ?? chatAvatar(row.user_id),
              is_owner: false,
            },
          ]);
          if (!knownName) void refresh();
        },
      )
      // 소프트삭제(is_deleted) 실시간 반영 — 누가 지우면 모두의 화면에서 즉시 제거
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: `spot_id=eq.${spotId}` },
        (payload) => {
          const row = payload.new as { id: string; is_deleted?: boolean };
          if (row.is_deleted) {
            setMessages((prev) => prev.filter((m) => m.id !== row.id));
            seenRef.current.delete(row.id);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, spotId, refresh]);

  useEffect(() => {
    for (const m of messages) {
      messagesNameCache.current.set(m.user_id, m.name);
      messagesAvatarCache.current.set(m.user_id, m.avatar);
    }
  }, [messages]);

  // 런처 배지 동기화 — 메시지 수가 바뀔 때마다 보고(로딩 끝난 뒤에만; 0으로 깜빡임 방지).
  useEffect(() => {
    if (!loading) onCount?.(messages.length);
  }, [messages.length, loading, onCount]);

  // 낙관적 전송: 보내는 즉시 내 화면에 '전송중'으로 띄우고, 서버 저장이 끝나면
  // 진짜 메시지(실제 id·시각)로 교체한다. 실패하면 '다시 시도'로 남긴다.
  const deliver = useCallback(
    async (text: string) => {
      if (!user) return;
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: ChatMessage = {
        id: tempId,
        user_id: user.id,
        body: text,
        created_at: new Date().toISOString(),
        name: chatNick(user.id),
        avatar: chatAvatar(user.id),
        is_owner: false,
        pending: true,
      };
      seenRef.current.add(tempId);
      setMessages((prev) => [...prev, optimistic]);
      try {
        const res = await fetch(`/api/chat/${spotId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? '전송에 실패했어요.');
        const real: ChatMessage = data.message;
        seenRef.current.add(real.id);
        // temp → real 치환. Realtime 에코가 먼저 왔으면 그 중복은 제거.
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== real.id || m.id === tempId)
            .map((m) => (m.id === tempId ? real : m)),
        );
      } catch (e) {
        setErr((e as Error).message);
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? { ...m, pending: false, failed: true } : m)),
        );
      }
    },
    [user, spotId],
  );

  const send = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setErr(null);
    setInput('');
    void deliver(text);
  }, [input, deliver]);

  const resend = useCallback(
    (m: ChatMessage) => {
      setErr(null);
      seenRef.current.delete(m.id);
      setMessages((prev) => prev.filter((x) => x.id !== m.id));
      void deliver(m.body);
    },
    [deliver],
  );

  // 삭제(사장님=전체, 일반=자기 것) — 낙관적으로 화면에서 제거, 실패하면 재조회로 복구.
  const deleteMessage = useCallback(
    async (id: string) => {
      if (typeof window !== 'undefined' && !window.confirm('이 메시지를 삭제할까요?')) return;
      setMessages((prev) => prev.filter((m) => m.id !== id));
      seenRef.current.delete(id);
      try {
        const res = await fetch(`/api/chat/${spotId}/messages/${id}`, { method: 'DELETE' });
        if (!res.ok) void refresh();
      } catch {
        void refresh();
      }
    },
    [spotId, refresh],
  );

  return (
    <div
      className="flex flex-col"
      style={
        embedded
          ? { height: '100%', background: '#fff', overflow: 'hidden' }
          : { height: '60vh', maxHeight: 520, background: '#fff', borderRadius: 14, overflow: 'hidden' }
      }
    >
      {/* 헤더 — 인라인 모드에서만. 플로팅 윈도우는 자체 헤더+닫기를 그린다. */}
      {!embedded && (
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: '1px solid #f3f4f6' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <span style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }} className="truncate">
              {spotName} 채팅
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center"
            style={{ color: '#9ca3af', background: '#f3f4f6', borderRadius: '50%', border: 'none' }}
            aria-label="채팅 닫기"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* 공지 핀 */}
      {notice && (
        <div style={{ background: '#fff7ed', borderBottom: '1px solid #fed7aa', padding: '8px 14px' }}>
          <button
            type="button"
            onClick={() => setNoticeOpen((v) => !v)}
            className="flex items-center gap-1.5 w-full text-left"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#ea580c', letterSpacing: 0.3 }}>📌 공지</span>
            {!noticeOpen && (
              <span className="truncate" style={{ fontSize: 12, color: '#9a3412' }}>{notice}</span>
            )}
          </button>
          {noticeOpen && (
            <p style={{ fontSize: 12.5, color: '#9a3412', lineHeight: 1.5, marginTop: 4, whiteSpace: 'pre-wrap' }}>
              {notice}
            </p>
          )}
        </div>
      )}

      {/* 메시지 리스트 */}
      <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-3" style={{ background: '#fafafa' }}>
        {!user && !userLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3">
            <p style={{ fontSize: 13, color: '#6b7280' }}>채팅에 참여하려면 로그인이 필요해요</p>
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              style={{ background: '#ea580c', color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 10, padding: '9px 18px', cursor: 'pointer' }}
            >
              로그인
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full">
            <span style={{ fontSize: 12.5, color: '#9ca3af' }}>불러오는 중…</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span style={{ fontSize: 12.5, color: '#9ca3af' }}>첫 메시지를 남겨보세요</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {[...messages]
              .filter((m) => m.user_id === user?.id || !isBlockedNick(m.name))
              .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
              .map((m) => {
              const mine = m.user_id === user?.id;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`} style={{ gap: 6 }}>
                  {!mine &&
                    ('url' in m.avatar ? (
                      <Image
                        src={m.avatar.url}
                        alt=""
                        width={28}
                        height={28}
                        aria-hidden="true"
                        style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, alignSelf: 'flex-start' }}
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        style={{ width: 28, height: 28, borderRadius: '50%', background: m.avatar.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, lineHeight: 1, flexShrink: 0, alignSelf: 'flex-start' }}
                      >
                        {m.avatar.emoji}
                      </div>
                    ))}
                  <div style={{ maxWidth: '78%' }}>
                    {!mine && (
                      <div className="flex items-center gap-1 mb-0.5 px-1">
                        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{m.name}</span>
                        {m.is_owner && (
                          <span style={{ fontSize: 9.5, fontWeight: 800, color: '#fff', background: '#ea580c', borderRadius: 5, padding: '1px 5px', letterSpacing: 0.2 }}>
                            사장님
                          </span>
                        )}
                      </div>
                    )}
                    <div
                      style={{
                        background: mine ? '#111827' : '#fff',
                        color: mine ? '#fff' : '#111827',
                        border: mine ? 'none' : '1px solid #f0f0f0',
                        borderRadius: 14,
                        padding: '8px 11px',
                        fontSize: 13.5,
                        lineHeight: 1.45,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        opacity: m.pending ? 0.55 : 1,
                      }}
                    >
                      {m.body}
                    </div>
                    {m.failed && (
                      <button
                        type="button"
                        onClick={() => resend(m)}
                        style={{ display: 'block', marginLeft: 'auto', marginTop: 3, fontSize: 10.5, fontWeight: 700, color: '#dc2626', background: 'none', border: 'none', padding: '2px 1px', cursor: 'pointer' }}
                      >
                        전송 실패 · 다시 시도
                      </button>
                    )}
                    {/* 운영 액션 — 실제 저장된 메시지에만(전송중/실패/temp 제외).
                        삭제: 사장님은 전체, 일반 유저는 자기 메시지만(서버 재검증). */}
                    {!m.pending && !m.failed && !m.id.startsWith('temp-') && (
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          marginTop: 2,
                          padding: '0 2px',
                          justifyContent: mine ? 'flex-end' : 'flex-start',
                        }}
                      >
                        {!mine && (
                          <button
                            type="button"
                            onClick={() => setReportTarget({ id: m.id, name: m.name })}
                            style={{ fontSize: 10.5, color: '#9ca3af', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                          >
                            신고
                          </button>
                        )}
                        {(canModerate || mine) && (
                          <button
                            type="button"
                            onClick={() => deleteMessage(m.id)}
                            style={{ fontSize: 10.5, color: mine && !canModerate ? '#9ca3af' : '#dc2626', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 입력창 — 로그인 상태에서만 활성 */}
      {user && (
        <div style={{ borderTop: '1px solid #f3f4f6', padding: '8px 10px' }}>
          {err && <p style={{ fontSize: 11.5, color: '#dc2626', margin: '0 0 6px 2px' }}>{err}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="메시지 입력…"
              rows={1}
              maxLength={1000}
              style={{
                flex: 1,
                resize: 'none',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
                padding: '9px 12px',
                fontSize: 13.5,
                lineHeight: 1.4,
                maxHeight: 96,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={!input.trim()}
              style={{
                flexShrink: 0,
                background: !input.trim() ? '#fdba74' : '#ea580c',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                border: 'none',
                borderRadius: 12,
                padding: '9px 16px',
                cursor: !input.trim() ? 'default' : 'pointer',
              }}
            >
              전송
            </button>
          </div>
        </div>
      )}

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        reason="채팅에 참여하려면 로그인이 필요해요"
      />
      <ReportModal
        open={reportTarget !== null}
        onClose={() => setReportTarget(null)}
        targetType="chat_message"
        targetId={reportTarget?.id ?? ''}
        authorNickname={reportTarget?.name}
        onBlocked={() => forceBlocked((n) => n + 1)}
      />
    </div>
  );
}

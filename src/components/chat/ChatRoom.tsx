'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { useUser } from '@/lib/useUser';
import LoginModal from '@/components/LoginModal';
import type { ChatMessage } from '@/lib/types';

// 가게별 채팅방(#6) 방 뷰 — 메시지 리스트 + 입력창 + Realtime 구독.
// MapClient는 ChatEntry를 통해 spotId/spotName/notice만 넘긴다(설계 §6.2).

interface Props {
  spotId: string;
  spotName: string;
  notice: string | null;
  onClose: () => void;
}

export default function ChatRoom({ spotId, spotName, notice, onClose }: Props) {
  const { user, loading: userLoading } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(true);

  const listRef = useRef<HTMLDivElement | null>(null);
  // 이미 가진 메시지 id — Realtime 에코/POST 응답 중복 방지.
  const seenRef = useRef<Set<string>>(new Set());
  // user_id → 표시명 캐시(Realtime 미해석 메시지의 이름 채우기용).
  const messagesNameCache = useRef<Map<string, string>>(new Map());

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
          const known = messagesNameCache.current.get(row.user_id);
          setMessages((prev) => [
            ...prev,
            {
              id: row.id,
              user_id: row.user_id,
              body: row.body,
              created_at: row.created_at,
              name: known ?? '…',
              is_owner: false,
            },
          ]);
          if (!known) void refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, spotId, refresh]);

  useEffect(() => {
    for (const m of messages) {
      if (m.name && m.name !== '…') messagesNameCache.current.set(m.user_id, m.name);
    }
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setErr(null);
    try {
      const res = await fetch(`/api/chat/${spotId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? '전송에 실패했어요.');
        return;
      }
      const msg: ChatMessage = data.message;
      if (!seenRef.current.has(msg.id)) {
        seenRef.current.add(msg.id);
        setMessages((prev) => [...prev, msg]);
      }
      setInput('');
    } catch {
      setErr('전송에 실패했어요.');
    } finally {
      setSending(false);
    }
  }, [input, sending, spotId]);

  return (
    <div
      className="flex flex-col"
      style={{ height: '60vh', maxHeight: 520, background: '#fff', borderRadius: 14, overflow: 'hidden' }}
    >
      {/* 헤더 */}
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
            {messages.map((m) => {
              const mine = m.user_id === user?.id;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
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
                        background: mine ? '#ea580c' : '#fff',
                        color: mine ? '#fff' : '#111827',
                        border: mine ? 'none' : '1px solid #f0f0f0',
                        borderRadius: 14,
                        padding: '8px 11px',
                        fontSize: 13.5,
                        lineHeight: 1.45,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {m.body}
                    </div>
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
              onClick={() => void send()}
              disabled={sending || !input.trim()}
              style={{
                flexShrink: 0,
                background: sending || !input.trim() ? '#fdba74' : '#ea580c',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                border: 'none',
                borderRadius: 12,
                padding: '9px 16px',
                cursor: sending || !input.trim() ? 'default' : 'pointer',
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
    </div>
  );
}

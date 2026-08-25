import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { LIAR_TOPICS } from '@/app/t/[slug]/gamesData';

// 라이어 게임 서버 — 방 상태는 전부 여기서만 읽고 쓴다 (RLS로 직조회 차단).
// 단어는 시민에게만, 라이어 여부는 본인에게만 내려간다.
// 클라는 GET 폴링(2초)으로 동기화 — 페이즈 전환이 느린 게임이라 충분.

const CODE_LEN = 4;
const MAX_PLAYERS = 8;
const MIN_PLAYERS = 3;

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

function friendly(error: unknown) {
  // Supabase PostgrestError는 Error 인스턴스가 아니라 plain object — message를 직접 꺼낸다
  const msg =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
  if (msg.includes('does not exist') || msg.includes('Could not find the table'))
    return NextResponse.json({ error: '게임이 아직 준비 중이에요. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  return NextResponse.json({ error: msg }, { status: 500 });
}

async function loadRoom(code: string) {
  const admin = supabaseAdmin();
  const { data: room, error } = await admin
    .from('game_rooms')
    .select('*')
    .eq('code', code)
    .gt('expires_at', new Date().toISOString())
    .neq('phase', 'closed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!room) return null;
  const { data: players, error: pErr } = await admin
    .from('game_players')
    .select('id, nick, vote, is_host, joined_at')
    .eq('room_id', room.id)
    .order('joined_at');
  if (pErr) throw pErr;
  return { room, players: players ?? [] };
}

function sanitize(room: Record<string, unknown>, players: { id: string; nick: string; vote: string | null; is_host: boolean }[], pid: string | null) {
  const done = room.phase === 'done';
  const isLiar = pid != null && room.liar_player === pid;
  return {
    room: {
      code: room.code,
      phase: room.phase,
      category: room.category,
      round: room.round,
      host_player: room.host_player,
      accused: room.accused,
      winner: done ? room.winner : null,
      liar_guess: done ? room.liar_guess : null,
      liar_player: done ? room.liar_player : null,
      // 단어: 시민은 게임 중 항상, 라이어는 끝나고 나서만
      word: done || (!isLiar && room.phase !== 'lobby') ? room.word : null,
    },
    players: players.map((p) => ({ id: p.id, nick: p.nick, is_host: p.is_host, voted: p.vote != null })),
    me: pid
      ? { id: pid, is_liar: room.phase !== 'lobby' ? isLiar : false, my_vote: players.find((p) => p.id === pid)?.vote ?? null }
      : null,
  };
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code') ?? '';
  const pid = request.nextUrl.searchParams.get('pid');
  try {
    const loaded = await loadRoom(code);
    if (!loaded) return NextResponse.json({ error: '방을 찾을 수 없어요. 코드를 확인해주세요.' }, { status: 404 });
    return NextResponse.json(sanitize(loaded.room, loaded.players, pid));
  } catch (e) {
    return friendly(e);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const action = typeof body.action === 'string' ? body.action : '';
  const admin = supabaseAdmin();

  try {
    // ── 방 만들기 ──
    if (action === 'create') {
      const nick = String(body.nick ?? '').trim().slice(0, 10);
      if (!nick) return NextResponse.json({ error: '닉네임을 입력해주세요.' }, { status: 400 });

      let spotId: string | null = null;
      if (typeof body.spot_slug === 'string' && body.spot_slug) {
        const { data: spot } = await admin.from('spots').select('id').eq('slug', body.spot_slug).maybeSingle();
        spotId = spot?.id ?? null;
      }

      for (let attempt = 0; attempt < 5; attempt++) {
        const code = String(Math.floor(Math.random() * 10 ** CODE_LEN)).padStart(CODE_LEN, '0');
        const { data: room, error } = await admin
          .from('game_rooms')
          .insert({ code, spot_id: spotId })
          .select('id')
          .single();
        if (error) {
          if (error.code === '23505') continue; // 코드 충돌 → 재시도
          throw error;
        }
        const { data: player, error: pErr } = await admin
          .from('game_players')
          .insert({ room_id: room.id, nick, is_host: true })
          .select('id')
          .single();
        if (pErr) throw pErr;
        await admin.from('game_rooms').update({ host_player: player.id }).eq('id', room.id);
        return NextResponse.json({ code, player_id: player.id }, { status: 201 });
      }
      return NextResponse.json({ error: '방 코드를 만들지 못했어요. 다시 시도해주세요.' }, { status: 500 });
    }

    // ── 이하 액션은 방이 필요 ──
    const code = String(body.code ?? '');
    const loaded = await loadRoom(code);
    if (!loaded) return NextResponse.json({ error: '방을 찾을 수 없어요. 코드를 확인해주세요.' }, { status: 404 });
    const { room, players } = loaded;
    const pid = typeof body.pid === 'string' ? body.pid : null;
    const me = players.find((p) => p.id === pid) ?? null;
    const isHost = me != null && room.host_player === me.id;
    const touch = { updated_at: new Date().toISOString() };

    if (action === 'join') {
      const nick = String(body.nick ?? '').trim().slice(0, 10);
      if (!nick) return NextResponse.json({ error: '닉네임을 입력해주세요.' }, { status: 400 });
      if (room.phase !== 'lobby')
        return NextResponse.json({ error: '이미 시작된 방이에요. 다음 판에 껴달라고 해보세요!' }, { status: 409 });
      if (players.length >= MAX_PLAYERS)
        return NextResponse.json({ error: `정원(${MAX_PLAYERS}명)이 찼어요.` }, { status: 409 });
      if (players.some((p) => p.nick === nick))
        return NextResponse.json({ error: '같은 닉네임이 이미 있어요. 다른 이름으로!' }, { status: 409 });
      const { data: player, error } = await admin
        .from('game_players')
        .insert({ room_id: room.id, nick })
        .select('id')
        .single();
      if (error) throw error;
      return NextResponse.json({ code, player_id: player.id }, { status: 201 });
    }

    if (!me) return NextResponse.json({ error: '방 참가자가 아니에요.' }, { status: 403 });

    // ── 시작 / 한 판 더 ──
    if (action === 'start' || action === 'again') {
      if (!isHost) return NextResponse.json({ error: '방장만 시작할 수 있어요.' }, { status: 403 });
      const okPhase = action === 'start' ? room.phase === 'lobby' : room.phase === 'done';
      if (!okPhase) return NextResponse.json({ error: '지금은 시작할 수 없어요.' }, { status: 409 });
      if (players.length < MIN_PLAYERS)
        return NextResponse.json({ error: `최소 ${MIN_PLAYERS}명이 필요해요. (현재 ${players.length}명)` }, { status: 409 });

      const topic = LIAR_TOPICS[Math.floor(Math.random() * LIAR_TOPICS.length)];
      const word = topic.words[Math.floor(Math.random() * topic.words.length)];
      const liar = players[Math.floor(Math.random() * players.length)];
      await admin.from('game_players').update({ vote: null }).eq('room_id', room.id);
      const { error } = await admin
        .from('game_rooms')
        .update({
          phase: 'discuss',
          category: topic.category,
          word,
          liar_player: liar.id,
          accused: null,
          winner: null,
          liar_guess: null,
          round: (room.round ?? 0) + 1,
          ...touch,
        })
        .eq('id', room.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    // ── 투표 열기 ──
    if (action === 'open_vote') {
      if (!isHost) return NextResponse.json({ error: '방장만 투표를 열 수 있어요.' }, { status: 403 });
      if (room.phase !== 'discuss') return NextResponse.json({ error: '지금은 투표를 열 수 없어요.' }, { status: 409 });
      await admin.from('game_players').update({ vote: null }).eq('room_id', room.id);
      const { error } = await admin.from('game_rooms').update({ phase: 'vote', ...touch }).eq('id', room.id);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    // ── 투표 ──
    if (action === 'vote') {
      if (room.phase !== 'vote') return NextResponse.json({ error: '지금은 투표 시간이 아니에요.' }, { status: 409 });
      const target = typeof body.target === 'string' ? body.target : '';
      if (!players.some((p) => p.id === target) || target === me.id)
        return NextResponse.json({ error: '올바른 대상을 골라주세요.' }, { status: 400 });
      const { error } = await admin.from('game_players').update({ vote: target }).eq('id', me.id);
      if (error) throw error;

      // 전원 투표 완료 → 집계
      const { data: after } = await admin
        .from('game_players')
        .select('id, vote')
        .eq('room_id', room.id);
      const all = after ?? [];
      if (all.every((p) => p.vote != null)) {
        const counts = new Map<string, number>();
        for (const p of all) counts.set(p.vote!, (counts.get(p.vote!) ?? 0) + 1);
        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        const tie = sorted.length > 1 && sorted[0][1] === sorted[1][1];
        const accused = tie ? null : sorted[0][0];

        if (!accused || accused !== room.liar_player) {
          // 동표거나 엉뚱한 사람 지목 → 라이어 승리
          await admin
            .from('game_rooms')
            .update({ phase: 'done', accused, winner: 'liar', ...touch })
            .eq('id', room.id);
        } else {
          // 라이어 적중 → 라이어에게 단어 역추리 기회
          await admin
            .from('game_rooms')
            .update({ phase: 'liar_guess', accused, ...touch })
            .eq('id', room.id);
        }
      }
      return NextResponse.json({ ok: true });
    }

    // ── 라이어 역추리 ──
    if (action === 'guess') {
      if (room.phase !== 'liar_guess') return NextResponse.json({ error: '지금은 추리 시간이 아니에요.' }, { status: 409 });
      if (me.id !== room.liar_player) return NextResponse.json({ error: '라이어만 답할 수 있어요.' }, { status: 403 });
      const text = String(body.text ?? '').trim().slice(0, 30);
      if (!text) return NextResponse.json({ error: '답을 입력해주세요.' }, { status: 400 });
      const correct = norm(text) === norm(String(room.word ?? ''));
      const { error } = await admin
        .from('game_rooms')
        .update({ phase: 'done', liar_guess: text, winner: correct ? 'liar' : 'citizens', ...touch })
        .eq('id', room.id);
      if (error) throw error;
      return NextResponse.json({ ok: true, correct });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) {
    return friendly(e);
  }
}

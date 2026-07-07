import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { assertAdmin } from '@/lib/adminAuth';

// 사장님 공지 관리 (playbook §1.6) — GET 전체 목록 / POST 새 공지.
export async function GET(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const { data, error } = await supabaseAdmin()
    .from('partner_notices')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notices: data ?? [] });
}

export async function POST(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 80) : '';
  const content = typeof body.body === 'string' ? body.body.trim().slice(0, 2000) : '';
  const type = body.type === 'popup' ? 'popup' : 'banner';
  if (!title || !content) {
    return NextResponse.json({ error: '제목과 내용을 입력해주세요.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from('partner_notices')
    .insert({ title, body: content, type })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notice: data }, { status: 201 });
}

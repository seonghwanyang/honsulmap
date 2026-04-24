import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const VALID_TYPES = ['post', 'comment'] as const;
const VALID_REASONS = ['spam', 'abuse', 'illegal', 'other'] as const;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const target_type = typeof body.target_type === 'string' ? body.target_type : '';
  const target_id = typeof body.target_id === 'string' ? body.target_id : '';
  const reason = typeof body.reason === 'string' ? body.reason : '';
  const detail = typeof body.detail === 'string' ? body.detail.trim() : '';
  const fingerprint = typeof body.fingerprint === 'string' ? body.fingerprint : '';

  if (!VALID_TYPES.includes(target_type as (typeof VALID_TYPES)[number])) {
    return NextResponse.json({ error: '신고 대상이 올바르지 않습니다.' }, { status: 400 });
  }
  if (!target_id || !/^[0-9a-f-]{36}$/i.test(target_id)) {
    return NextResponse.json({ error: '신고 대상 ID가 올바르지 않습니다.' }, { status: 400 });
  }
  if (!VALID_REASONS.includes(reason as (typeof VALID_REASONS)[number])) {
    return NextResponse.json({ error: '신고 사유를 선택해주세요.' }, { status: 400 });
  }
  if (detail.length > 500) {
    return NextResponse.json({ error: '상세 사유는 500자 이내로 입력해주세요.' }, { status: 400 });
  }
  if (!fingerprint) {
    return NextResponse.json({ error: '신고 요청이 유효하지 않습니다.' }, { status: 400 });
  }

  const { error } = await supabase.from('reports').insert([
    {
      target_type,
      target_id,
      reason,
      detail: detail || null,
      fingerprint,
    },
  ]);

  if (error) {
    // 23505 = unique_violation: fingerprint already reported this target
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: '이미 신고한 항목입니다.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

// Gate every partner spot op on membership: the caller must be an owner/manager
// of this spot (verified from the session, then checked against spot_members).
async function requireMember(id: string) {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user)
    return { error: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }) } as const;

  const admin = supabaseAdmin();
  const { data: member } = await admin
    .from('spot_members')
    .select('role')
    .eq('spot_id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!member)
    return { error: NextResponse.json({ error: '권한이 없는 가게예요.' }, { status: 403 }) } as const;

  return { admin, role: member.role as 'owner' | 'manager' } as const;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMember(id);
  if ('error' in ctx) return ctx.error;
  const { admin, role } = ctx;

  const [{ data: spot }, { data: vc }, { data: vis }, { count: favCount }] = await Promise.all([
    admin
      .from('spots')
      .select(
        'id, name, slug, region, category, instagram_id, memo, business_hours, phone, vip_until, like_count, mood_up, mood_down, benefit_title, benefit_detail, benefit_active, benefit_expires_at, redeem_pin',
      )
      .eq('id', id)
      .maybeSingle(),
    admin.from('spot_view_counts').select('views').eq('spot_id', id).maybeSingle(),
    admin.from('spot_visit_counts').select('visits').eq('spot_id', id).maybeSingle(),
    // 찜 수 — 나중에 "찜한 손님 푸시"의 발송 대상 크기이기도 하다
    admin.from('favorites').select('user_id', { count: 'exact', head: true }).eq('spot_id', id),
  ]);
  if (!spot) return NextResponse.json({ error: '가게를 찾을 수 없습니다.' }, { status: 404 });

  return NextResponse.json({
    role,
    spot,
    stats: {
      views: vc?.views ?? 0,
      visits: vis?.visits ?? 0,
      likes: spot.like_count ?? 0,
      favorites: favCount ?? 0,
      mood_up: spot.mood_up ?? 0,
      mood_down: spot.mood_down ?? 0,
    },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireMember(id);
  if ('error' in ctx) return ctx.error;
  const { admin } = ctx;

  const body = await request.json().catch(() => ({}));
  // Owners/managers may edit only these. name/slug/region/address/coords/IG stay
  // operator-controlled (identity & SEO), so they are never read from the body.
  const patch: Record<string, unknown> = {};
  if (typeof body.memo === 'string') patch.memo = body.memo.trim().slice(0, 500) || null;
  if (typeof body.business_hours === 'string')
    patch.business_hours = body.business_hours.trim().slice(0, 100) || null;
  if (typeof body.phone === 'string') patch.phone = body.phone.trim().slice(0, 30) || null;
  // 가게 혜택(#8): 인증 사장님만 등록/수정. active=true + title 있을 때 노출.
  let benefitTouched = false;
  if (typeof body.benefit_title === 'string') {
    patch.benefit_title = body.benefit_title.trim().slice(0, 40) || null;
    benefitTouched = true;
  }
  if (typeof body.benefit_detail === 'string') {
    patch.benefit_detail = body.benefit_detail.trim().slice(0, 200) || null;
    benefitTouched = true;
  }
  if (typeof body.benefit_active === 'boolean') {
    patch.benefit_active = body.benefit_active;
    benefitTouched = true;
  }
  if (typeof body.benefit_expires_at === 'string') {
    patch.benefit_expires_at = body.benefit_expires_at;
    benefitTouched = true;
  } else if (body.benefit_expires_at === null) {
    patch.benefit_expires_at = null;
    benefitTouched = true;
  }
  // 리딤 PIN(playbook §1.1) — 4자리 숫자만, 빈 값이면 해제(GPS 전용).
  if (typeof body.redeem_pin === 'string') {
    const p = body.redeem_pin.trim();
    if (p && !/^\d{4}$/.test(p)) {
      return NextResponse.json({ error: 'PIN은 숫자 4자리로 입력해주세요.' }, { status: 400 });
    }
    patch.redeem_pin = p || null;
  }
  if (benefitTouched) patch.benefit_updated_at = new Date().toISOString();

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: '변경할 내용이 없습니다.' }, { status: 400 });

  const { data, error } = await admin
    .from('spots')
    .update(patch)
    .eq('id', id)
    .select('memo, business_hours, phone, benefit_title, benefit_detail, benefit_active, benefit_expires_at, redeem_pin')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

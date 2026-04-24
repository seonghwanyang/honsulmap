import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const VALID_REGIONS = ['jeju', 'aewol', 'seogwipo', 'east', 'west'] as const;
const VALID_CATEGORIES = ['bar', 'guesthouse'] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  const patch: Record<string, unknown> = {};
  if (typeof body.name === 'string') patch.name = body.name.trim();
  if (typeof body.slug === 'string') {
    const slug = body.slug.trim().toLowerCase();
    if (!/^[a-z0-9가-힣-]+$/.test(slug))
      return NextResponse.json(
        { error: 'slug는 영문 소문자·숫자·한글·하이픈만 가능합니다.' },
        { status: 400 },
      );
    patch.slug = slug;
  }
  if (typeof body.region === 'string') {
    if (!VALID_REGIONS.includes(body.region as (typeof VALID_REGIONS)[number]))
      return NextResponse.json({ error: '지역이 올바르지 않습니다.' }, { status: 400 });
    patch.region = body.region;
  }
  if (typeof body.category === 'string') {
    if (!VALID_CATEGORIES.includes(body.category as (typeof VALID_CATEGORIES)[number]))
      return NextResponse.json({ error: '카테고리가 올바르지 않습니다.' }, { status: 400 });
    patch.category = body.category;
  }
  if (typeof body.address === 'string') patch.address = body.address.trim();
  if (body.lat != null) {
    const lat = Number(body.lat);
    if (!Number.isFinite(lat)) return NextResponse.json({ error: 'lat' }, { status: 400 });
    patch.lat = lat;
  }
  if (body.lng != null) {
    const lng = Number(body.lng);
    if (!Number.isFinite(lng)) return NextResponse.json({ error: 'lng' }, { status: 400 });
    patch.lng = lng;
  }
  if (typeof body.instagram_id === 'string')
    patch.instagram_id = body.instagram_id.trim().replace(/^@/, '') || null;
  if (typeof body.naver_place_id === 'string')
    patch.naver_place_id = body.naver_place_id.trim() || null;
  if (typeof body.phone === 'string') patch.phone = body.phone.trim() || null;
  if (typeof body.business_hours === 'string')
    patch.business_hours = body.business_hours.trim() || null;
  if (typeof body.memo === 'string') patch.memo = body.memo.trim() || null;

  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: '변경할 내용이 없습니다.' }, { status: 400 });

  const { data, error } = await supabaseAdmin()
    .from('spots')
    .update(patch)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: '이미 존재하는 slug입니다.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { error } = await supabaseAdmin().from('spots').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

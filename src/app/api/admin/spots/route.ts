import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const VALID_REGIONS = ['jeju', 'aewol', 'seogwipo', 'east', 'west'] as const;
const VALID_CATEGORIES = ['bar', 'guesthouse'] as const;

// List all spots (no story join) for the admin table.
export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from('spots')
    .select('id, name, slug, region, category, address, lat, lng, instagram_id, created_at')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
  const region = typeof body.region === 'string' ? body.region : '';
  const category = typeof body.category === 'string' ? body.category : 'bar';
  const address = typeof body.address === 'string' ? body.address.trim() : '';
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const instagram_id =
    typeof body.instagram_id === 'string'
      ? body.instagram_id.trim().replace(/^@/, '') || null
      : null;
  const naver_place_id =
    typeof body.naver_place_id === 'string' ? body.naver_place_id.trim() || null : null;
  const phone = typeof body.phone === 'string' ? body.phone.trim() || null : null;
  const business_hours =
    typeof body.business_hours === 'string' ? body.business_hours.trim() || null : null;
  const memo = typeof body.memo === 'string' ? body.memo.trim() || null : null;

  if (!name) return NextResponse.json({ error: '가게명이 필요합니다.' }, { status: 400 });
  if (!slug || !/^[a-z0-9가-힣-]+$/.test(slug))
    return NextResponse.json(
      { error: 'slug는 영문 소문자·숫자·한글·하이픈만 가능합니다.' },
      { status: 400 },
    );
  if (!VALID_REGIONS.includes(region as (typeof VALID_REGIONS)[number]))
    return NextResponse.json({ error: '지역을 선택해주세요.' }, { status: 400 });
  if (!VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number]))
    return NextResponse.json({ error: '카테고리를 선택해주세요.' }, { status: 400 });
  if (!address) return NextResponse.json({ error: '주소가 필요합니다.' }, { status: 400 });
  if (!Number.isFinite(lat) || !Number.isFinite(lng))
    return NextResponse.json({ error: '좌표(lat, lng)가 필요합니다.' }, { status: 400 });

  const { data, error } = await supabaseAdmin()
    .from('spots')
    .insert([
      {
        name,
        slug,
        region,
        category,
        address,
        lat,
        lng,
        instagram_id,
        naver_place_id,
        phone,
        business_hours,
        memo,
      },
    ])
    .select()
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: '이미 존재하는 slug입니다.' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

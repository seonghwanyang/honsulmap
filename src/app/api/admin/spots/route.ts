import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { assertAdmin } from '@/lib/adminAuth';
import { VALID_REGIONS } from '@/lib/types';

const VALID_CATEGORIES = ['bar', 'guesthouse'] as const;

// List all spots (no story join) for the admin table, each annotated with
// 조회수 (spot_views) + 다녀왔어요 (spot_visits) counts.
export async function GET(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const sb = supabaseAdmin();
  const [spotsRes, viewsRes, visitsRes] = await Promise.all([
    sb
      .from('spots')
      .select('id, name, slug, region, category, address, lat, lng, instagram_id, created_at')
      .order('created_at', { ascending: false }),
    sb.from('spot_view_counts').select('spot_id, views'),
    sb.from('spot_visit_counts').select('spot_id, visits'),
  ]);
  if (spotsRes.error)
    return NextResponse.json({ error: spotsRes.error.message }, { status: 500 });

  // Counts come pre-aggregated from DB views (one row per spot), so reading
  // the whole view never hits PostgREST's Max Rows cap. Aggregate functions
  // are disabled on this project (PGRST123), hence the views.
  const views = new Map<string, number>();
  for (const r of (viewsRes.data as { spot_id: string; views: number }[] | null) ?? [])
    views.set(r.spot_id, r.views);
  const visits = new Map<string, number>();
  for (const r of (visitsRes.data as { spot_id: string; visits: number }[] | null) ?? [])
    visits.set(r.spot_id, r.visits);

  const data = (spotsRes.data ?? []).map((s) => ({
    ...s,
    view_count: views.get(s.id) ?? 0,
    visit_count: visits.get(s.id) ?? 0,
  }));
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

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

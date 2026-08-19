import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isTableTester } from '@/lib/tableTesters';

// 메뉴 편집 (사장님) — 배치도와 같은 전량 교체 패턴.
// GET은 네이버 수집 메뉴(spots.naver_menus)도 함께 내려 "가져오기" 시드로 쓴다.
// 주문 이력은 스냅샷(item_name/price)이라 메뉴 교체에 안전.

async function assertMember(spotId: string) {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user || !isTableTester(user.email)) return null; // 베타: 테스터만
  const admin = supabaseAdmin();
  const { data } = await admin
    .from('spot_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('spot_id', spotId)
    .maybeSingle();
  return data ? admin : null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = await assertMember(id);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const [{ data: spot }, { data: categories }, { data: items }] = await Promise.all([
    admin.from('spots').select('name, slug, naver_menus').eq('id', id).single(),
    admin.from('store_menu_categories').select('*').eq('spot_id', id).order('sort'),
    admin.from('store_menu_items').select('*').eq('spot_id', id).order('sort'),
  ]);

  return NextResponse.json({
    spot: { name: spot?.name, slug: spot?.slug },
    naver_menus: spot?.naver_menus ?? [],
    categories: (categories ?? []).map((c) => ({
      ...c,
      items: (items ?? []).filter((i) => i.category_id === c.id),
    })),
  });
}

interface ItemInput {
  name: string;
  price: number;
  description?: string | null;
  sold_out?: boolean;
  zero_action?: 'call' | 'recommend' | 'report' | 'gift' | null;
}
interface CategoryInput {
  name: string;
  items: ItemInput[];
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = await assertMember(id);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const categories: CategoryInput[] = Array.isArray(body?.categories) ? body.categories : [];

  if (categories.length > 20)
    return NextResponse.json({ error: '카테고리는 최대 20개예요.' }, { status: 400 });
  for (const c of categories) {
    if (!c.name?.trim() || c.name.length > 20)
      return NextResponse.json({ error: '카테고리 이름을 1~20자로 입력해주세요.' }, { status: 400 });
    if (!Array.isArray(c.items) || c.items.length > 100)
      return NextResponse.json({ error: '메뉴 데이터가 올바르지 않아요.' }, { status: 400 });
    for (const it of c.items) {
      if (!it.name?.trim() || it.name.length > 60)
        return NextResponse.json({ error: '메뉴 이름을 1~60자로 입력해주세요.' }, { status: 400 });
      if (!Number.isInteger(it.price) || it.price < 0 || it.price > 10_000_000)
        return NextResponse.json({ error: `'${it.name}' 가격이 올바르지 않아요.` }, { status: 400 });
    }
  }

  const { error: delErr } = await admin.from('store_menu_categories').delete().eq('spot_id', id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  for (let ci = 0; ci < categories.length; ci++) {
    const c = categories[ci];
    const { data: cat, error: cErr } = await admin
      .from('store_menu_categories')
      .insert({ spot_id: id, name: c.name.trim(), sort: ci })
      .select('id')
      .single();
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

    if (c.items.length) {
      const { error: iErr } = await admin.from('store_menu_items').insert(
        c.items.map((it, ii) => ({
          category_id: cat.id,
          spot_id: id,
          name: it.name.trim(),
          price: it.price,
          description: it.description?.trim() || null,
          sold_out: !!it.sold_out,
          zero_action: it.zero_action ?? null,
          sort: ii,
        })),
      );
      if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

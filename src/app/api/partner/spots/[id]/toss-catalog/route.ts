import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isTableTester } from '@/lib/tableTesters';
import { tossFetchAll, tossMerchantId } from '@/lib/tossplace';

// 토스 포스 카탈로그 → 메뉴판 가져오기용 (사장님 메뉴 편집기 시드).
// 판매중(enabled + ON_SALE) 상품을 포스 카테고리 순서 그대로 그룹핑해 내려준다.

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

interface TossCatalogItem {
  title: string;
  state: string;
  enabled: boolean;
  order?: number;
  description?: string | null;
  category?: { id?: string; title?: string; order?: number };
  price?: { priceValue?: number };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = await assertMember(id);
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: cfg } = await admin
    .from('store_table_config')
    .select('modes')
    .eq('spot_id', id)
    .maybeSingle();
  const mid = tossMerchantId(cfg?.modes);
  if (!mid) return NextResponse.json({ connected: false, categories: [] });

  const raw = await tossFetchAll<TossCatalogItem>(`/merchants/${mid}/catalog/items`);
  if (!raw) return NextResponse.json({ error: '토스에서 메뉴를 불러오지 못했어요.' }, { status: 502 });

  const sellable = raw.filter((it) => it.enabled && it.state === 'ON_SALE' && (it.price?.priceValue ?? 0) > 0);
  const catMap = new Map<string, { name: string; order: number; items: { name: string; price: number; description: string | null }[] }>();
  for (const it of sellable) {
    const key = it.category?.id ?? '?';
    if (!catMap.has(key)) {
      catMap.set(key, { name: it.category?.title ?? '메뉴', order: it.category?.order ?? 99, items: [] });
    }
    catMap.get(key)!.items.push({
      name: it.title.slice(0, 60),
      price: it.price?.priceValue ?? 0,
      description: it.description?.slice(0, 200) || null,
    });
  }
  const categories = [...catMap.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ name, items }) => ({ name, items }));

  return NextResponse.json({ connected: true, categories });
}

import { supabase, supabaseAdmin } from '@/lib/supabase';
import type { Metadata } from 'next';
import TableClient from './TableClient';
import type { MenuCategory, PublicSession } from './TableClient';

// 테이블 서비스 손님 진입점 — 좌석 QR(/t/{slug}?seat=N)이 여는 페이지.
// 서버에서 배치도·메뉴·활성 세션을 한 번에 내려주고, 이후는 TableClient가
// 체크인·주문·폴링을 담당한다.

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug); // 한글 slug (예: 끌림365-게스트하우스)
  const { data: spot } = await supabase.from('spots').select('name').eq('slug', slug).maybeSingle();
  return {
    title: spot ? `${spot.name} 테이블 | 혼술맵` : '테이블 | 혼술맵',
    robots: { index: false }, // 테이블 전용 페이지는 검색 노출 제외
  };
}

export default async function TablePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ seat?: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug); // 한글 slug 대응
  const { seat } = await searchParams;

  const { data: spot } = await supabase
    .from('spots')
    .select('id, name, slug, avatar_url')
    .eq('slug', slug)
    .maybeSingle();

  if (!spot) return <Shell title="혼술맵 테이블">가게를 찾을 수 없어요.</Shell>;

  const admin = supabaseAdmin();
  const [{ data: config }, { data: zones }, { data: seats }, { data: cats }, { data: items }, { data: sessions }] =
    await Promise.all([
      // select * — 마이그레이션 전후 컬럼 차이에 안전 (없는 컬럼을 지명하면 쿼리 전체가 죽는다)
      supabase.from('store_table_config').select('*').eq('spot_id', spot.id).maybeSingle(),
      supabase.from('store_zones').select('id, name, grid_rows, grid_cols').eq('spot_id', spot.id).order('sort'),
      supabase.from('store_seats').select('id, zone_id, label, "row", col, seat_type').eq('spot_id', spot.id).eq('active', true),
      supabase.from('store_menu_categories').select('id, name').eq('spot_id', spot.id).order('sort'),
      supabase.from('store_menu_items').select('id, category_id, name, price, description, sold_out, zero_action').eq('spot_id', spot.id).order('sort'),
      // 세션은 RLS로 잠겨 있어 서버에서 공개 필드만 골라 내린다 (/state와 동일 규칙)
      admin
        .from('table_sessions')
        .select('seat_id, gender, age_band, mbti, purpose, vibe, tmi, drink_pref, is_public')
        .eq('spot_id', spot.id)
        .eq('active', true)
        .gt('expires_at', new Date().toISOString()),
    ]);

  if (!config?.enabled) {
    return (
      <Shell title={spot.name}>
        아직 테이블 서비스 준비 중이에요.
        <br />
        직원에게 직접 주문해주세요 🙂
      </Shell>
    );
  }

  const categories: MenuCategory[] = (cats ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    items: (items ?? [])
      .filter((i) => i.category_id === c.id)
      .map(({ category_id: _omit, ...rest }) => rest),
  }));

  const publicSessions: PublicSession[] = (sessions ?? []).map((s) =>
    s.is_public ? s : { seat_id: s.seat_id, gender: s.gender, is_public: false },
  );

  // modes에는 토스 매장번호 등 내부 값도 있어 손님에게는 필요한 플래그만 추려 보낸다
  const modes = (config.modes as { order?: boolean; social?: boolean } | null) ?? {};

  return (
    <TableClient
      spot={spot}
      modes={{ order: modes.order, social: modes.social }}
      liveStatus={config.live_status ?? 'open'}
      zones={zones ?? []}
      seats={seats ?? []}
      categories={categories}
      initialSessions={publicSessions}
      seatParam={seat ?? null}
      checkinPurposes={(config.checkin_purposes as string[] | null) ?? null}
      checkinVibes={(config.checkin_vibes as string[] | null) ?? null}
    />
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'radial-gradient(85% 50% at 0% 0%, rgba(255,236,210,0.1) 0%, rgba(255,236,210,0) 60%), #0c0c0e', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.3px' }}>혼술맵 테이블</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: '6px 0 14px' }}>{title}</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>{children}</p>
      </div>
    </div>
  );
}

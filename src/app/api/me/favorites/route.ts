import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

// 마이페이지 "내 찜" 목록: 로그인 유저의 찜한 가게 + 활성 스토리 여부(새 소식 배지).
// 신원은 세션 쿠키에서, 데이터는 service role(찜은 RLS self지만 spots/stories 조인을
// 위해 service role로 한 번에).
export async function GET() {
  const sb = await createServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = supabaseAdmin();
  const { data: favs } = await admin
    .from('favorites')
    .select('spot_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  const ids = (favs ?? []).map((f) => f.spot_id);
  if (ids.length === 0) return NextResponse.json({ favorites: [] });

  const [{ data: spots }, { data: live }] = await Promise.all([
    admin.from('spots').select('id, name, slug, region, category').in('id', ids),
    admin.from('stories').select('spot_id').in('spot_id', ids).gt('expires_at', new Date().toISOString()),
  ]);

  const fresh = new Set((live ?? []).map((s) => s.spot_id));
  const byId = new Map((spots ?? []).map((s) => [s.id, s]));

  // Preserve favorite order (most recent first), fresh-story spots bubbled up.
  const favorites = ids
    .map((id) => {
      const spot = byId.get(id);
      return spot ? { ...spot, has_fresh_story: fresh.has(id) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => Number(b!.has_fresh_story) - Number(a!.has_fresh_story));

  return NextResponse.json({ favorites });
}

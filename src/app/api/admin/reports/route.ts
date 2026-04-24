import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// List reports with minimal target previews (post title/content or comment
// content + nickname) so the admin can triage without extra round-trips.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const db = supabaseAdmin();
  let query = db
    .from('reports')
    .select('*')
    .order('status', { ascending: true }) // pending < resolved < dismissed (alpha)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data: reports, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const postIds = Array.from(
    new Set((reports || []).filter((r) => r.target_type === 'post').map((r) => r.target_id)),
  );
  const commentIds = Array.from(
    new Set((reports || []).filter((r) => r.target_type === 'comment').map((r) => r.target_id)),
  );

  const [postRes, commentRes] = await Promise.all([
    postIds.length
      ? db.from('posts').select('id, title, content, nickname, spot_id').in('id', postIds)
      : Promise.resolve({ data: [], error: null }),
    commentIds.length
      ? db
          .from('comments')
          .select('id, content, nickname, post_id, spot_id')
          .in('id', commentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const postMap = new Map((postRes.data || []).map((p) => [p.id, p]));
  const commentMap = new Map((commentRes.data || []).map((c) => [c.id, c]));

  const enriched = (reports || []).map((r) => ({
    ...r,
    target:
      r.target_type === 'post'
        ? postMap.get(r.target_id) || null
        : commentMap.get(r.target_id) || null,
  }));

  return NextResponse.json(enriched);
}

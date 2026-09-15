import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { assertAdmin } from '@/lib/adminAuth';

// 대시보드 숫자 4개 — 건수만 센다. 예전엔 목록 4개를 통째로 받아 length를 셌고
// 그중 가게 목록이 275KB(755곳)라 폰에서 대시보드가 느렸다 (09-15 실측).
export async function GET(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const db = supabaseAdmin();
  const head = { count: 'exact' as const, head: true };
  const [requests, claims, reports, spots] = await Promise.all([
    db.from('spot_requests').select('id', head).eq('status', 'pending'),
    db.from('spot_claims').select('id', head).eq('status', 'pending'),
    db.from('reports').select('id', head).eq('status', 'pending'),
    db.from('spots').select('id', head),
  ]);

  return NextResponse.json({
    pending_requests: requests.count ?? 0,
    pending_claims: claims.count ?? 0,
    pending_reports: reports.count ?? 0,
    total_spots: spots.count ?? 0,
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { assertAdmin } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  let query = supabaseAdmin()
    .from('spot_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

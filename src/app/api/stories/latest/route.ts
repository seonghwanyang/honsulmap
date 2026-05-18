import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const city = searchParams.get('city');
  const region = searchParams.get('region');
  const offsetRaw = parseInt(searchParams.get('offset') || '0', 10);
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0;

  let query = supabase
    .from('stories')
    .select('*, spot:spots!inner(name, slug, city, region, category)')
    .order('posted_at', { ascending: false });

  if (city && city !== 'all') {
    query = query.eq('spot.city', city);
  }
  if (region && region !== 'all') {
    query = query.eq('spot.region', region);
  }

  const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || [], {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
  });
}

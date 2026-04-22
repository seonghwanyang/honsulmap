import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const region = searchParams.get('region');

  let query = supabase
    .from('stories')
    .select('*, spot:spots!inner(name, slug, region, category)')
    .order('posted_at', { ascending: false });

  if (region && region !== 'all') {
    query = query.eq('spot.region', region);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

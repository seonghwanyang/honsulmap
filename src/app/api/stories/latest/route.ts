import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .gt('expires_at', now)
    .order('posted_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

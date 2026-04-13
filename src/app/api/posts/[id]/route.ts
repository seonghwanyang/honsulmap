import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from('posts')
    .select(`
      id,
      spot_id,
      category,
      title,
      content,
      nickname,
      image_urls,
      like_count,
      comment_count,
      created_at,
      spot:spots (
        id,
        name,
        slug,
        region,
        category,
        address,
        lat,
        lng,
        instagram_id,
        like_count,
        mood_up,
        mood_down,
        image_urls,
        created_at
      )
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { password, ...updates } = body;

  if (!password) {
    return NextResponse.json({ error: '비밀번호가 필요합니다.' }, { status: 400 });
  }

  // Fetch post for password verification
  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('id, password_hash')
    .eq('id', id)
    .single();

  if (fetchError || !post) {
    return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
  }

  const isValid = await bcrypt.compare(password, post.password_hash);
  if (!isValid) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 403 });
  }

  // Remove password_hash from updates if accidentally included
  delete updates.password_hash;

  const { data, error } = await supabase
    .from('posts')
    .update(updates)
    .eq('id', id)
    .select(`
      id,
      spot_id,
      category,
      title,
      content,
      nickname,
      image_urls,
      like_count,
      comment_count,
      created_at
    `)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { password } = body;

  if (!password) {
    return NextResponse.json({ error: '비밀번호가 필요합니다.' }, { status: 400 });
  }

  // Fetch post for password verification
  const { data: post, error: fetchError } = await supabase
    .from('posts')
    .select('id, password_hash')
    .eq('id', id)
    .single();

  if (fetchError || !post) {
    return NextResponse.json({ error: '게시글을 찾을 수 없습니다.' }, { status: 404 });
  }

  const isValid = await bcrypt.compare(password, post.password_hash);
  if (!isValid) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 403 });
  }

  const { error } = await supabase.from('posts').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

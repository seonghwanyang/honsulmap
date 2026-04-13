import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import type { PostCreateRequest } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const spot_id = searchParams.get('spot_id');
  const limit = parseInt(searchParams.get('limit') ?? '20', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  let query = supabase
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
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) {
    query = query.eq('category', category);
  }
  if (spot_id) {
    query = query.eq('spot_id', spot_id);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const body: PostCreateRequest = await request.json();
  const { category, title, content, nickname, password, spot_id, image_urls } = body;

  // Validation
  if ((category === 'status' || category === 'review') && !spot_id) {
    return NextResponse.json(
      { error: '현황/후기 게시글에는 가게 정보가 필요합니다.' },
      { status: 400 }
    );
  }
  if (!title?.trim()) {
    return NextResponse.json({ error: '제목을 입력해주세요.' }, { status: 400 });
  }
  if (!content?.trim()) {
    return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 });
  }
  if (!password || password.length < 4) {
    return NextResponse.json({ error: '비밀번호는 4자 이상이어야 합니다.' }, { status: 400 });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from('posts')
    .insert([
      {
        category,
        title: title.trim(),
        content: content.trim(),
        nickname,
        password_hash,
        spot_id: spot_id ?? null,
        image_urls: image_urls ?? null,
      },
    ])
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

  return NextResponse.json(data, { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import type { PostCreateRequest } from '@/lib/types';
import { generatePostSlug } from '@/lib/utils';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { isObjectionable } from '@/lib/contentFilter';

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
      slug,
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
  const ip = clientIp(request);
  if (!(await rateLimit('post:create', ip, 600, 5))) {
    return NextResponse.json(
      { error: '글을 너무 자주 올리고 있어요. 잠시 후 다시 시도해주세요.' },
      { status: 429 },
    );
  }

  const body = (await request.json()) as PostCreateRequest & { spot_name?: string };
  const { category, title, content, nickname, password, spot_id, image_urls } = body;
  const spotNameRaw = typeof body.spot_name === 'string' ? body.spot_name.trim() : '';

  // Validation
  if (!nickname?.trim() || nickname.trim().length < 2 || nickname.trim().length > 20) {
    return NextResponse.json({ error: '닉네임은 2~20자로 입력해주세요.' }, { status: 400 });
  }
  if (!password || password.length < 4) {
    return NextResponse.json({ error: '비밀번호는 4자 이상이어야 합니다.' }, { status: 400 });
  }
  if ((category === 'status' || category === 'review') && !spot_id && !spotNameRaw) {
    return NextResponse.json(
      { error: '현황·후기 게시글은 가게를 선택하거나 이름을 입력해주세요.' },
      { status: 400 }
    );
  }
  if (!title?.trim() || title.trim().length > 100) {
    return NextResponse.json({ error: '제목을 1~100자로 입력해주세요.' }, { status: 400 });
  }
  if (!content?.trim() || content.trim().length > 2000) {
    return NextResponse.json({ error: '내용을 1~2000자로 입력해주세요.' }, { status: 400 });
  }
  if (isObjectionable(title, content)) {
    return NextResponse.json(
      { error: '부적절한 표현이 포함되어 있어 등록할 수 없습니다.' },
      { status: 400 },
    );
  }

  const password_hash = await bcrypt.hash(password, 10);

  // If the user typed a free-text spot name (venue not in DB), prepend it to
  // the content as a meta line so it's preserved without requiring a schema
  // change. The post still lands with spot_id = null.
  const finalContent = !spot_id && spotNameRaw
    ? `📍 ${spotNameRaw}\n\n${content.trim()}`
    : content.trim();

  // Generate a unique slug from the title. Dedup loop appends -2/-3/...
  // — bounded to ~30 attempts since collisions on a fresh post are rare.
  const baseSlug = generatePostSlug(title.trim());
  let slug = baseSlug;
  for (let n = 2; n < 30; n += 1) {
    const { data: existing } = await supabase
      .from('posts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${n}`;
  }

  const { data, error } = await supabase
    .from('posts')
    .insert([
      {
        category,
        title: title.trim(),
        slug,
        content: finalContent,
        nickname: nickname.trim(),
        password_hash,
        spot_id: spot_id ?? null,
        image_urls: image_urls ?? null,
      },
    ])
    .select(`
      id,
      slug,
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

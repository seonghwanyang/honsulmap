import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';
import type { CommentCreateRequest, Comment } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const post_id = searchParams.get('post_id');
  const spot_id = searchParams.get('spot_id');

  if (!post_id && !spot_id) {
    return NextResponse.json(
      { error: 'post_id 또는 spot_id가 필요합니다.' },
      { status: 400 }
    );
  }

  if (post_id) {
    // Tree structure: parent comments + their replies
    const { data, error } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', post_id)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const all = (data || []) as Comment[];
    const parents = all.filter((c) => c.parent_id === null);
    const tree = parents.map((parent) => ({
      ...parent,
      replies: all.filter((c) => c.parent_id === parent.id),
    }));

    return NextResponse.json(tree);
  }

  // spot_id → flat array
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('spot_id', spot_id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const body: CommentCreateRequest = await request.json();
  const { post_id, spot_id, parent_id, nickname, password, content } = body;

  // Validation: exactly one of post_id or spot_id
  if ((!post_id && !spot_id) || (post_id && spot_id)) {
    return NextResponse.json(
      { error: 'post_id 또는 spot_id 중 하나만 입력해주세요.' },
      { status: 400 }
    );
  }

  // No replies on spot comments
  if (spot_id && parent_id) {
    return NextResponse.json(
      { error: '가게 댓글에는 대댓글 불가' },
      { status: 400 }
    );
  }

  if (!content?.trim()) {
    return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 });
  }
  if (!password || password.length < 4) {
    return NextResponse.json({ error: '비밀번호는 4자 이상이어야 합니다.' }, { status: 400 });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from('comments')
    .insert([
      {
        post_id: post_id ?? null,
        spot_id: spot_id ?? null,
        parent_id: parent_id ?? null,
        nickname,
        password_hash,
        content: content.trim(),
      },
    ])
    .select('id, post_id, spot_id, parent_id, nickname, content, like_count, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Increment comment_count on the post if applicable
  if (post_id) {
    const { data: post } = await supabase
      .from('posts')
      .select('comment_count')
      .eq('id', post_id)
      .single();

    if (post) {
      await supabase
        .from('posts')
        .update({ comment_count: (post.comment_count ?? 0) + 1 })
        .eq('id', post_id);
    }
  }

  return NextResponse.json(data, { status: 201 });
}

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

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

  // Fetch comment for password verification
  const { data: comment, error: fetchError } = await supabase
    .from('comments')
    .select('id, password_hash, post_id')
    .eq('id', id)
    .single();

  if (fetchError || !comment) {
    return NextResponse.json({ error: '댓글을 찾을 수 없습니다.' }, { status: 404 });
  }

  const isValid = await bcrypt.compare(password, comment.password_hash);
  if (!isValid) {
    return NextResponse.json({ error: '비밀번호가 올바르지 않습니다.' }, { status: 403 });
  }

  const { error } = await supabase.from('comments').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Decrement comment_count on the post if applicable
  if (comment.post_id) {
    const { data: post } = await supabase
      .from('posts')
      .select('comment_count')
      .eq('id', comment.post_id)
      .single();

    if (post) {
      await supabase
        .from('posts')
        .update({ comment_count: Math.max(0, (post.comment_count ?? 1) - 1) })
        .eq('id', comment.post_id);
    }
  }

  return NextResponse.json({ success: true });
}

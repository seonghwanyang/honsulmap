import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import PostClient from './PostClient';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://honsulmap.com';

const CATEGORY_LABELS: Record<string, string> = {
  status: '현황',
  review: '후기',
  tip: '꿀팁',
  free: '자유',
};

interface PostRow {
  id: string;
  category: string;
  title: string;
  content: string;
  nickname: string;
  created_at: string;
  spot?: { name: string } | null;
}

async function getPost(id: string): Promise<PostRow | null> {
  const { data } = await supabase
    .from('posts')
    .select('id, category, title, content, nickname, created_at, spot:spots(name)')
    .eq('id', id)
    .maybeSingle();
  return (data as unknown as PostRow) || null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) {
    return {
      title: '게시글',
      robots: { index: false, follow: false },
    };
  }

  const cat = CATEGORY_LABELS[post.category] || '자유';
  const title = `${post.title} · ${cat}`;
  const description = (post.content || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || `제주 혼술맵 ${cat} 게시글`;

  return {
    title,
    description,
    alternates: { canonical: `/post/${id}` },
    openGraph: {
      type: 'article',
      title,
      description,
      url: `${SITE_URL}/post/${id}`,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPost(id);

  const jsonLd = post
    ? {
        '@context': 'https://schema.org',
        '@type': 'DiscussionForumPosting',
        headline: post.title,
        articleBody: post.content,
        datePublished: post.created_at,
        author: { '@type': 'Person', name: post.nickname },
        url: `${SITE_URL}/post/${id}`,
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <PostClient />
    </>
  );
}

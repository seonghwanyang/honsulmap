import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import PostClient from './PostClient';
import { jsonLdScript } from '@/lib/utils';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://honsulmap.com';

const CATEGORY_LABELS: Record<string, string> = {
  status: '현황',
  review: '후기',
  tip: '꿀팁',
  free: '자유',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PostRow {
  id: string;
  slug: string | null;
  category: string;
  title: string;
  content: string;
  nickname: string;
  created_at: string;
  image_urls: string[] | null;
  like_count: number;
  spot?: { name: string } | null;
}

async function getPostBySlugOrId(key: string): Promise<PostRow | null> {
  const column = UUID_RE.test(key) ? 'id' : 'slug';
  const { data } = await supabase
    .from('posts')
    .select('id, slug, category, title, content, nickname, created_at, image_urls, like_count, spot:spots(name)')
    .eq(column, key)
    .maybeSingle();
  return (data as unknown as PostRow) || null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const key = decodeURIComponent(slug);
  const post = await getPostBySlugOrId(key);
  if (!post) {
    return {
      title: '게시글',
      robots: { index: false, follow: false },
    };
  }

  const canonicalKey = post.slug || post.id;
  const cat = CATEGORY_LABELS[post.category] || '자유';
  const title = `${post.title} · ${cat}`;
  const description = (post.content || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || `혼술맵 ${cat} 게시글`;

  return {
    title,
    description,
    alternates: { canonical: `/post/${canonicalKey}` },
    openGraph: {
      type: 'article',
      title,
      description,
      url: `${SITE_URL}/post/${canonicalKey}`,
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
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const key = decodeURIComponent(slug);
  const post = await getPostBySlugOrId(key);

  // Legacy UUID URL → 308 redirect to the canonical slug URL so any
  // previously indexed UUID links carry their SEO value over to the
  // new slug. Skip if the post has no slug yet (pre-backfill window).
  if (post && UUID_RE.test(key) && post.slug) {
    // Encode the slug: non-ASCII (Korean) slugs would otherwise be written
    // raw into the Location header, which must be a ByteString — that throws
    // server-side and turns the redirect into a 500 (GSC "서버 오류 5xx").
    permanentRedirect(`/post/${encodeURIComponent(post.slug)}`);
  }

  const canonicalKey = post?.slug || post?.id;
  const jsonLd = post
    ? {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        articleBody: post.content,
        datePublished: post.created_at,
        author: { '@type': 'Person', name: post.nickname },
        url: `${SITE_URL}/post/${canonicalKey}`,
        mainEntityOfPage: `${SITE_URL}/post/${canonicalKey}`,
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
        />
      )}
      <PostClient initialPost={post} />
    </>
  );
}

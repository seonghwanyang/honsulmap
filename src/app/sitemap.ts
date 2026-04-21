import type { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://honsulmap.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'hourly', priority: 1.0 },
    { url: `${SITE_URL}/feed`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/community`, lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
  ];

  const [{ data: spots }, { data: posts }] = await Promise.all([
    supabase.from('spots').select('slug, created_at').order('created_at', { ascending: false }),
    supabase.from('posts').select('id, created_at').order('created_at', { ascending: false }).limit(500),
  ]);

  const spotRoutes: MetadataRoute.Sitemap = (spots || []).map((s) => ({
    url: `${SITE_URL}/spot/${s.slug}`,
    lastModified: s.created_at ? new Date(s.created_at) : now,
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  const postRoutes: MetadataRoute.Sitemap = (posts || []).map((p) => ({
    url: `${SITE_URL}/post/${p.id}`,
    lastModified: p.created_at ? new Date(p.created_at) : now,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  return [...staticRoutes, ...spotRoutes, ...postRoutes];
}

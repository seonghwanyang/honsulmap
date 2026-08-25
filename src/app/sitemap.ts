import type { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';
import { CITIES } from '@/lib/types';
import type { City, Region } from '@/lib/types';
import { AREAS, MIN_PAGE_SPOTS, assignArea, districtToUrlSlug } from '@/lib/areas';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://honsulmap.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'hourly', priority: 1.0 },
    { url: `${SITE_URL}/feed`, lastModified: now, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/community`, lastModified: now, changeFrequency: 'hourly', priority: 0.8 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/faq`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/benefits`, lastModified: now, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];

  const regionRoutes: MetadataRoute.Sitemap = CITIES.map((c) => ({
    url: `${SITE_URL}/region/${c.value}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.8,
  }));

  const [{ data: spots }, { data: posts }] = await Promise.all([
    supabase.from('spots').select('slug, created_at, city, region, lat, lng').order('created_at', { ascending: false }),
    supabase.from('posts').select('id, slug, created_at').order('created_at', { ascending: false }).limit(500),
  ]);

  // 구/시·상권 페이지 — 페이지 게이트(MIN_PAGE_SPOTS)와 동일 기준으로만 등재
  const districtCounts = new Map<string, number>();
  const areaCounts = new Map<string, number>();
  for (const s of spots || []) {
    const key = `${s.city}|${s.region}`;
    districtCounts.set(key, (districtCounts.get(key) || 0) + 1);
    const area = s.lat && s.lng ? assignArea(s) : null;
    if (area?.mode === 'page') areaCounts.set(area.slug, (areaCounts.get(area.slug) || 0) + 1);
  }
  const districtRoutes: MetadataRoute.Sitemap = [...districtCounts.entries()]
    .filter(([, n]) => n >= MIN_PAGE_SPOTS)
    .map(([key]) => {
      const [city, region] = key.split('|');
      return {
        url: `${SITE_URL}/region/${city}/${districtToUrlSlug(city as City, region as Region)}`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      };
    });
  const areaRoutes: MetadataRoute.Sitemap = AREAS.filter(
    (a) => a.mode === 'page' && (areaCounts.get(a.slug) || 0) >= MIN_PAGE_SPOTS,
  ).map((a) => ({
    url: `${SITE_URL}/region/${a.city}/${districtToUrlSlug(a.city, a.district)}/${a.slug}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  const spotRoutes: MetadataRoute.Sitemap = (spots || []).map((s) => ({
    url: `${SITE_URL}/spot/${encodeURIComponent(s.slug)}`,
    lastModified: s.created_at ? new Date(s.created_at) : now,
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  const postRoutes: MetadataRoute.Sitemap = (posts || []).map((p) => ({
    url: `${SITE_URL}/post/${encodeURIComponent(p.slug || p.id)}`,
    lastModified: p.created_at ? new Date(p.created_at) : now,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  return [...staticRoutes, ...regionRoutes, ...districtRoutes, ...areaRoutes, ...spotRoutes, ...postRoutes];
}

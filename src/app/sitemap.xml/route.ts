import { publicConfig } from '@/lib/public-config';

export const revalidate = 900;

export async function GET() {
  const now = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${publicConfig.siteUrl}/sitemap-pages.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${publicConfig.siteUrl}/sitemap-blog.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>
</sitemapindex>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 's-maxage=900, stale-while-revalidate=3600',
    },
  });
}

import { PUBLIC_SITEMAP_INTERNAL_PATHS, buildAbsoluteUrl, buildLocalizedPath } from '@/lib/seo';
import { SUPPORTED_LOCALES } from '@/lib/i18n';

export const revalidate = 900;

export async function GET() {
  const lastmod = new Date().toISOString();
  const entries = SUPPORTED_LOCALES.flatMap((locale) =>
    PUBLIC_SITEMAP_INTERNAL_PATHS.map((path) => buildAbsoluteUrl(buildLocalizedPath(locale.code, path))),
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((url) => `  <url><loc>${url}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 's-maxage=900, stale-while-revalidate=3600',
    },
  });
}

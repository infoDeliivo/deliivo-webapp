import { SUPPORTED_LOCALES } from '@/lib/i18n';
import { buildAbsoluteUrl, buildLocalizedPath, fetchPublishedPostsForLocale } from '@/lib/seo';

export const revalidate = 900;

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export async function GET() {
  const localePosts = await Promise.all(
    SUPPORTED_LOCALES.map(async (locale) => ({
      locale: locale.code,
      posts: (await fetchPublishedPostsForLocale(locale.code)) || [],
    })),
  );

  const entries = localePosts.flatMap(({ locale, posts }) =>
    posts.map((post) => ({
      url: buildAbsoluteUrl(buildLocalizedPath(locale, `/blog/${post.slug}`)),
      lastmod: post.updatedAt || post.publishedAt || new Date().toISOString(),
    })),
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map((entry) => `  <url><loc>${escapeXml(entry.url)}</loc><lastmod>${entry.lastmod}</lastmod></url>`)
  .join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 's-maxage=900, stale-while-revalidate=3600',
    },
  });
}

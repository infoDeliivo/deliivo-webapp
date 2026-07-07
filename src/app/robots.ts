import type { MetadataRoute } from 'next';
import { SUPPORTED_LOCALES } from '@/lib/i18n';
import { buildLocalizedPath } from '@/lib/seo';
import { publicConfig } from '@/lib/public-config';

const disallowedInternalPaths = [
  '/admin',
  '/auth',
  '/chat',
  '/driver',
  '/onboarding',
  '/profile',
  '/publish',
  '/rides',
  '/tracking',
  '/search',
];

export default function robots(): MetadataRoute.Robots {
  const localizedDisallow = SUPPORTED_LOCALES.flatMap((locale) =>
    disallowedInternalPaths.map((path) => buildLocalizedPath(locale.code, path)),
  );

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: localizedDisallow,
    },
    host: publicConfig.siteUrl,
    sitemap: [
      `${publicConfig.siteUrl}/sitemap.xml`,
      `${publicConfig.siteUrl}/sitemap-pages.xml`,
      `${publicConfig.siteUrl}/sitemap-blog.xml`,
    ],
  };
}

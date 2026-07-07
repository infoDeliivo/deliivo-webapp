import { dictionaries } from './i18n-dictionaries';
import { DEFAULT_LOCALE, localeToUrlCode, SUPPORTED_LOCALES, type SupportedLocale } from './i18n';
import { publicConfig } from './public-config';

export const SEO_HEADER_LOCALE = 'x-deliivo-locale';
export const SEO_HEADER_LOCALIZED_PATH = 'x-deliivo-localized-path';
export const SEO_HEADER_INTERNAL_PATH = 'x-deliivo-internal-path';

const NOINDEX_EXACT_PATHS = new Set(['/search']);
const NOINDEX_PREFIXES = [
  '/admin',
  '/auth',
  '/chat',
  '/driver',
  '/onboarding',
  '/profile',
  '/publish',
  '/rides',
  '/tracking',
];

export const PUBLIC_SITEMAP_INTERNAL_PATHS = ['/', '/blog', '/contact', '/faq', '/terms', '/privacy'] as const;

type TranslationParams = Record<string, string | number>;

type BlogSeoPost = {
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl?: string | null;
  publishedAt?: string | null;
  updatedAt?: string;
  locale: string;
};

type SeoResolved = {
  locale: SupportedLocale;
  htmlLang: string;
  localizedPath: string;
  internalPath: string;
  canonicalUrl: string;
  title: string;
  description: string;
  robotsContent: string;
  ogType: 'website' | 'article';
  ogImage: string;
  ogLocale: string;
  articlePublishedAt?: string | null;
  alternateLocaleLinks: Array<{ hrefLang: string; href: string }>;
};

function interpolate(value: string, params?: TranslationParams) {
  if (!params) return value;
  return Object.entries(params).reduce(
    (text, [key, replacement]) => text.replaceAll(`{${key}}`, String(replacement)),
    value,
  );
}

export function translateSeo(locale: SupportedLocale, key: string, params?: TranslationParams) {
  return interpolate(dictionaries[locale]?.[key] || dictionaries.en[key] || key, params);
}

export function normalizeInternalPath(pathname?: string | null) {
  if (!pathname || pathname === '/') return '/';
  const withLeadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const normalized = withLeadingSlash.replace(/\/+$/, '');
  return normalized || '/';
}

export function buildLocalizedPath(locale: SupportedLocale, internalPath: string) {
  const normalizedInternalPath = normalizeInternalPath(internalPath);
  const prefix = `/${localeToUrlCode(locale)}`;
  return normalizedInternalPath === '/' ? prefix : `${prefix}${normalizedInternalPath}`;
}

export function buildAbsoluteUrl(pathname: string) {
  const normalizedPath = pathname === '/' ? '' : pathname.replace(/\/+$/, '');
  return `${publicConfig.siteUrl}${normalizedPath}`;
}

export function getHtmlLang(locale: SupportedLocale) {
  if (locale === 'et') return 'et';
  return locale;
}

function getOgLocale(locale: SupportedLocale) {
  if (locale === 'et') return 'et_EE';
  if (locale === 'ru') return 'ru_RU';
  return 'en_US';
}

function isNoindexPath(internalPath: string) {
  const normalized = normalizeInternalPath(internalPath);
  if (NOINDEX_EXACT_PATHS.has(normalized)) return true;
  return NOINDEX_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

async function fetchContentFromBackend<T>(pathname: string) {
  const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backendUrl) return null;

  try {
    const response = await fetch(`${backendUrl}${pathname}`, {
      next: { revalidate: 900 },
      headers: { accept: 'application/json' },
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return (payload?.data ?? null) as T | null;
  } catch {
    return null;
  }
}

export async function fetchPublishedPostsForLocale(locale: SupportedLocale) {
  const query = new URLSearchParams({ locale });
  return fetchContentFromBackend<BlogSeoPost[]>(`/api/v1/content/posts?${query.toString()}`);
}

async function fetchBlogPost(slug: string, locale: SupportedLocale) {
  const query = new URLSearchParams({ locale });
  return fetchContentFromBackend<BlogSeoPost>(`/api/v1/content/posts/${encodeURIComponent(slug)}?${query.toString()}`);
}

function resolveDefaultSeoCopy(locale: SupportedLocale, internalPath: string, blogPost: BlogSeoPost | null) {
  if (internalPath === '/') {
    return {
      title: `${translateSeo(locale, 'home.heroTitle')} | Deliivo`,
      description: translateSeo(locale, 'home.heroCopy'),
    };
  }
  if (internalPath === '/blog') {
    return {
      title: `${translateSeo(locale, 'nav.guides')} | Deliivo`,
      description: translateSeo(locale, 'blog.copy'),
    };
  }
  if (internalPath.startsWith('/blog/')) {
    if (blogPost?.locale === locale) {
      return {
        title: `${blogPost.title} | Deliivo`,
        description: blogPost.excerpt,
      };
    }
    return {
      title: `${translateSeo(locale, 'blog.articleUnavailable')} | Deliivo`,
      description: translateSeo(locale, 'blog.articleNotFound'),
    };
  }
  if (internalPath === '/contact') {
    return {
      title: `${translateSeo(locale, 'contact.title')} | Deliivo`,
      description: translateSeo(locale, 'contact.copy'),
    };
  }
  if (internalPath === '/faq') {
    return {
      title: `${translateSeo(locale, 'faq.title')} | Deliivo`,
      description: translateSeo(locale, 'faq.quickStartIntro'),
    };
  }
  if (internalPath === '/terms') {
    return {
      title: `${translateSeo(locale, 'legal.termsTitle')} | Deliivo`,
      description: translateSeo(locale, 'legal.marketplaceRoleBody'),
    };
  }
  if (internalPath === '/privacy') {
    return {
      title: `${translateSeo(locale, 'privacy.title')} | Deliivo`,
      description: translateSeo(locale, 'privacy.dataBody'),
    };
  }
  if (internalPath === '/search') {
    return {
      title: `${translateSeo(locale, 'search.title')} | Deliivo`,
      description: translateSeo(locale, 'search.emptyCopy'),
    };
  }
  if (internalPath === '/publish') {
    return {
      title: `${translateSeo(locale, 'publish.title')} | Deliivo`,
      description: translateSeo(locale, 'publish.searchDepartureDestination'),
    };
  }
  if (internalPath === '/auth/signin') {
    return {
      title: `${translateSeo(locale, 'nav.signIn')} | Deliivo`,
      description: translateSeo(locale, 'home.heroCopy'),
    };
  }
  if (internalPath === '/auth/signup') {
    return {
      title: `${translateSeo(locale, 'nav.signUp')} | Deliivo`,
      description: translateSeo(locale, 'home.heroCopy'),
    };
  }

  return {
    title: 'Deliivo - Baltic Carpooling',
    description: 'Deliivo connects drivers and passengers across Estonia, Latvia, and Lithuania for affordable regional carpooling.',
  };
}

export async function resolveSeoForRequest(locale: SupportedLocale, internalPath: string, localizedPath: string): Promise<SeoResolved> {
  const normalizedInternalPath = normalizeInternalPath(internalPath);
  const normalizedLocalizedPath = normalizeInternalPath(localizedPath);
  let blogPost: BlogSeoPost | null = null;
  let alternateLocaleLinks = SUPPORTED_LOCALES.map((option) => ({
    hrefLang: option.code === 'et' ? 'et' : option.code,
    href: buildAbsoluteUrl(buildLocalizedPath(option.code, normalizedInternalPath)),
  }));

  if (normalizedInternalPath.startsWith('/blog/')) {
    const slug = normalizedInternalPath.slice('/blog/'.length);
    const localizedPosts = await Promise.all(
      SUPPORTED_LOCALES.map(async (option) => ({
        locale: option.code,
        post: await fetchBlogPost(slug, option.code),
      })),
    );

    blogPost = localizedPosts.find((entry) => entry.locale === locale)?.post
      || localizedPosts.find((entry) => entry.post)?.post
      || null;

    alternateLocaleLinks = localizedPosts
      .filter((entry) => entry.post)
      .map((entry) => ({
        hrefLang: entry.locale === 'et' ? 'et' : entry.locale,
        href: buildAbsoluteUrl(buildLocalizedPath(entry.locale, `/blog/${slug}`)),
      }));
  }

  const resolvedCopy = resolveDefaultSeoCopy(locale, normalizedInternalPath, blogPost);
  const shouldIndex = !isNoindexPath(normalizedInternalPath) && localizedPostsExist(locale, blogPost, normalizedInternalPath);
  return {
    locale,
    htmlLang: getHtmlLang(locale),
    localizedPath: normalizedLocalizedPath,
    internalPath: normalizedInternalPath,
    canonicalUrl: buildAbsoluteUrl(normalizedLocalizedPath),
    title: resolvedCopy.title,
    description: resolvedCopy.description,
    robotsContent: shouldIndex ? 'index, follow, max-image-preview:large' : 'noindex, nofollow',
    ogType: normalizedInternalPath.startsWith('/blog/') && blogPost ? 'article' : 'website',
    ogImage: blogPost?.coverImageUrl || buildAbsoluteUrl(publicConfig.defaultOgImagePath),
    ogLocale: getOgLocale(locale),
    articlePublishedAt: blogPost?.publishedAt || blogPost?.updatedAt || null,
    alternateLocaleLinks,
  };
}

function localizedPostsExist(locale: SupportedLocale, blogPost: BlogSeoPost | null, internalPath: string) {
  if (!internalPath.startsWith('/blog/')) return true;
  return Boolean(blogPost && blogPost.locale === locale);
}

export function resolveLocaleFromHeader(rawLocale?: string | null): SupportedLocale {
  return (SUPPORTED_LOCALES.find((option) => option.code === rawLocale)?.code || DEFAULT_LOCALE) as SupportedLocale;
}

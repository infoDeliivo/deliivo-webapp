import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import { cache } from 'react';
import './globals.css';
import { Providers } from './providers';
import { publicConfig } from '@/lib/public-config';
import {
  buildLocalizedPath,
  resolveLocaleFromHeader,
  resolveSeoForRequest,
  SEO_HEADER_INTERNAL_PATH,
  SEO_HEADER_LOCALIZED_PATH,
  SEO_HEADER_LOCALE,
} from '@/lib/seo';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
});

const getRequestSeo = cache(async () => {
  const requestHeaders = await headers();
  const locale = resolveLocaleFromHeader(requestHeaders.get(SEO_HEADER_LOCALE));
  const internalPath = requestHeaders.get(SEO_HEADER_INTERNAL_PATH) || '/';
  const localizedPath = requestHeaders.get(SEO_HEADER_LOCALIZED_PATH) || buildLocalizedPath(locale, internalPath);
  return resolveSeoForRequest(locale, internalPath, localizedPath);
});

export async function generateMetadata(): Promise<Metadata> {
  const resolvedSeo = await getRequestSeo();
  const languageAlternates = Object.fromEntries(
    resolvedSeo.alternateLocaleLinks.map((entry) => [entry.hrefLang, entry.href]),
  );
  const xDefaultHref = languageAlternates.en || resolvedSeo.alternateLocaleLinks[0]?.href || resolvedSeo.canonicalUrl;
  const allowIndexing = resolvedSeo.robotsContent.startsWith('index');

  return {
    metadataBase: new URL(publicConfig.siteUrl),
    title: resolvedSeo.title,
    description: resolvedSeo.description,
    alternates: {
      canonical: resolvedSeo.canonicalUrl,
      languages: {
        ...languageAlternates,
        'x-default': xDefaultHref,
      },
    },
    robots: allowIndexing
      ? {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
          },
        }
      : {
          index: false,
          follow: false,
          googleBot: {
            index: false,
            follow: false,
          },
        },
    verification: {
      google: publicConfig.googleSiteVerification,
    },
    openGraph: {
      type: resolvedSeo.ogType,
      siteName: 'Deliivo',
      title: resolvedSeo.title,
      description: resolvedSeo.description,
      url: resolvedSeo.canonicalUrl,
      locale: resolvedSeo.ogLocale,
      images: [
        {
          url: resolvedSeo.ogImage,
          alt: resolvedSeo.title,
        },
      ],
      ...(resolvedSeo.ogType === 'article' && resolvedSeo.articlePublishedAt
        ? { publishedTime: resolvedSeo.articlePublishedAt }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: resolvedSeo.title,
      description: resolvedSeo.description,
      images: [resolvedSeo.ogImage],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const resolvedSeo = await getRequestSeo();
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Deliivo',
    url: publicConfig.siteUrl,
    logo: `${publicConfig.siteUrl}/logo.png`,
    description: 'Baltic carpooling platform connecting drivers and riders across Estonia, Latvia, and Lithuania.',
    areaServed: ['Estonia', 'Latvia', 'Lithuania'],
    sameAs: [
      publicConfig.facebookUrl,
      publicConfig.instagramUrl,
      publicConfig.xUrl,
      publicConfig.tiktokUrl,
      publicConfig.linkedinUrl,
    ],
  };

  return (
    <html lang={resolvedSeo.htmlLang} className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-screen flex-col overflow-x-hidden bg-deliivo-cream font-sans text-deliivo-dark">
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${publicConfig.gaMeasurementId}`}
          strategy="afterInteractive"
        />
        <Script id="ga4" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${publicConfig.gaMeasurementId}');`}
        </Script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

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
        {/*
          Consent Mode v2 defaults. Raw <script> rather than next/script so it executes
          inline, in document order, strictly before the container below - GTM reads the
          consent state at load time and anything arriving later is already too late.
          Deliivo serves EE/LV/LT, so everything non-essential starts denied.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'granted',security_storage:'granted',wait_for_update:500});`,
          }}
        />
        {publicConfig.gtmContainerId ? (
          <Script id="gtm" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${publicConfig.gtmContainerId}');`}
          </Script>
        ) : null}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        {publicConfig.gtmContainerId ? (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${publicConfig.gtmContainerId}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        ) : null}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

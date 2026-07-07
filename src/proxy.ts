import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  localeToUrlCode,
  LOCALE_COOKIE_NAME,
  urlCodeToLocale,
} from './lib/i18n';
import { SEO_HEADER_INTERNAL_PATH, SEO_HEADER_LOCALIZED_PATH, SEO_HEADER_LOCALE } from './lib/seo';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split('/').filter(Boolean);
  const pathLocale = urlCodeToLocale(segments[0]);

  if (pathLocale) {
    const rewrittenUrl = request.nextUrl.clone();
    rewrittenUrl.pathname = segments.length > 1 ? `/${segments.slice(1).join('/')}` : '/';
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(SEO_HEADER_LOCALE, pathLocale);
    requestHeaders.set(SEO_HEADER_LOCALIZED_PATH, pathname);
    requestHeaders.set(SEO_HEADER_INTERNAL_PATH, rewrittenUrl.pathname);
    const response = NextResponse.rewrite(rewrittenUrl, {
      request: { headers: requestHeaders },
    });
    response.cookies.set(LOCALE_COOKIE_NAME, pathLocale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
    return response;
  }

  const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const locale = isSupportedLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
  const localizedUrl = request.nextUrl.clone();
  const prefix = localeToUrlCode(locale);
  localizedUrl.pathname = pathname === '/' ? `/${prefix}` : `/${prefix}${pathname}`;
  return NextResponse.redirect(localizedUrl);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};

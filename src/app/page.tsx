'use client';

import Link from 'next/link';
import { CalendarCheck, Car, CreditCard, MapPin, Route, Search, ShieldCheck, Star, Users, Wallet } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useTranslation } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';
import HomepageV2 from '@/components/HomepageV2';

const featuredRoutes = [
  {
    from: 'Tallinn',
    to: 'Tartu',
    price: 12,
    duration: '2h 20m',
  },
  {
    from: 'Riga',
    to: 'Vilnius',
    price: 16,
    duration: '4h 10m',
  },
  {
    from: 'Vilnius',
    to: 'Kaunas',
    price: 7,
    duration: '1h 20m',
  },
];

const riderSteps = [
  {
    step: '01',
    icon: <Search className="h-5 w-5" />,
    titleKey: 'home.riderStep1Title',
    descriptionKey: 'home.riderStep1Copy',
  },
  {
    step: '02',
    icon: <CreditCard className="h-5 w-5" />,
    titleKey: 'home.riderStep2Title',
    descriptionKey: 'home.riderStep2Copy',
  },
  {
    step: '03',
    icon: <CalendarCheck className="h-5 w-5" />,
    titleKey: 'home.riderStep3Title',
    descriptionKey: 'home.riderStep3Copy',
  },
];

const driverSteps = [
  {
    step: '01',
    icon: <Route className="h-5 w-5" />,
    titleKey: 'home.driverStep1Title',
    descriptionKey: 'home.driverStep1Copy',
  },
  {
    step: '02',
    icon: <Users className="h-5 w-5" />,
    titleKey: 'home.driverStep2Title',
    descriptionKey: 'home.driverStep2Copy',
  },
  {
    step: '03',
    icon: <Wallet className="h-5 w-5" />,
    titleKey: 'home.driverStep3Title',
    descriptionKey: 'home.driverStep3Copy',
  },
];

const whyDeliivo = [
  {
    icon: <ShieldCheck className="h-7 w-7 text-primary-500" />,
    titleKey: 'home.verifiedDrivers',
    descriptionKey: 'home.verifiedDriversCopy',
  },
  {
    icon: <Star className="h-7 w-7 text-primary-500" />,
    titleKey: 'home.trustedCommunity',
    descriptionKey: 'home.trustedCommunityCopy',
  },
  {
    icon: <Users className="h-7 w-7 text-primary-500" />,
    titleKey: 'home.womenOnlyOption',
    descriptionKey: 'home.womenOnlyOptionCopy',
  },
  {
    icon: (
      <span className="flex h-7 w-7 items-center justify-center text-xs font-bold leading-none">
        EUR
      </span>
    ),
    titleKey: 'home.regionalFares',
    descriptionKey: 'home.regionalFaresCopy',
  },
];

function LegacyHomePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="flex min-h-full flex-col">
      <Navbar />

      <main className="flex-1">
        <section className="relative overflow-hidden bg-deliivo-cream px-4 py-12 sm:px-6 sm:py-20">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-primary-200/30 blur-3xl" />
            <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-orange-200/30 blur-3xl" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/60 to-transparent" />
          </div>

          <div className="relative mx-auto max-w-5xl text-center">
            <span className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary-100 bg-white/80 px-4 py-1.5 text-sm font-medium text-primary-600 shadow-sm backdrop-blur">
              <MapPin size={14} />
              {t('home.region')}
            </span>

            <h1 className="text-4xl font-extrabold tracking-tight text-deliivo-dark sm:text-5xl lg:text-6xl">
              {t('home.heroTitle')}
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-lg text-deliivo-gray sm:text-xl">
              {t('home.heroCopy')}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/search" className="btn-primary px-6 py-3 text-base">
                {t('home.findRide')}
              </Link>
              <Link
                href="/publish"
                className="inline-flex items-center justify-center rounded-full border border-primary-200 bg-white px-6 py-3 text-base font-semibold text-deliivo-dark shadow-sm transition-colors hover:bg-primary-50"
              >
                {t('home.publishRoute')}
              </Link>
            </div>

            <p className="mt-4 text-sm text-deliivo-gray">
              Browse available rides without signing in. Book or publish when you are ready.
            </p>
            {user && (
              <p className="mt-2 text-sm font-semibold text-deliivo-dark">
                Welcome back, {user.name || user.nickName || 'rider'}.
              </p>
            )}

            <div className="mx-auto mt-10 max-w-4xl rounded-3xl border border-primary-100/80 bg-white p-5 shadow-xl shadow-primary-100/30">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div className="text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-500">
                    {t('home.corridor')}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-deliivo-dark">
                    Featured Baltic route
                  </h2>
                </div>
                <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-600">
                  EUR
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {featuredRoutes.map((route) => (
                  <Link
                    key={`${route.from}-${route.to}`}
                    href={`/search?from=${encodeURIComponent(route.from)}&to=${encodeURIComponent(route.to)}`}
                    className="flex items-center justify-between rounded-xl border border-gray-100 bg-gradient-to-r from-white to-primary-50/30 px-4 py-4 shadow-sm transition-colors hover:border-primary-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-full border-2 border-primary-500 bg-white" />
                        <span className="h-5 w-0.5 bg-primary-200" />
                        <span className="h-2.5 w-2.5 rounded-full bg-primary-500" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-deliivo-dark">{route.from}</p>
                        <p className="text-sm text-deliivo-gray">{route.to}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary-500">EUR {route.price}</p>
                      <p className="text-xs text-deliivo-gray">{route.duration}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <h2 className="text-2xl font-bold text-deliivo-dark sm:text-3xl">
                {t('home.howTitle')}
              </h2>
              <p className="mt-2 text-deliivo-gray">
                {t('home.howCopy')}
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <div className="mb-5 flex items-center justify-center gap-2 lg:justify-start">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-primary-500 shadow-sm">
                    <Users className="h-5 w-5" />
                  </span>
                  <h3 className="text-lg font-bold text-deliivo-dark">{t('home.forRiders')}</h3>
                </div>
                <div className="grid gap-4">
                  {riderSteps.map((item) => (
                    <div key={item.step} className="flex gap-4 rounded-2xl bg-primary-50/40 p-5 shadow-sm">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-primary-500">
                        {item.icon}
                      </div>
                      <div>
                        <span className="text-xs font-bold uppercase text-primary-400">{t('home.step', { step: item.step })}</span>
                        <h4 className="mt-0.5 font-bold text-deliivo-dark">{t(item.titleKey)}</h4>
                        <p className="mt-1 text-sm leading-relaxed text-deliivo-gray">{t(item.descriptionKey)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-5 flex items-center justify-center gap-2 lg:justify-start">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-primary-500 shadow-sm">
                    <Car className="h-5 w-5" />
                  </span>
                  <h3 className="text-lg font-bold text-deliivo-dark">{t('home.forDrivers')}</h3>
                </div>
                <div className="grid gap-4">
                  {driverSteps.map((item) => (
                    <div key={item.step} className="flex gap-4 rounded-2xl bg-primary-50/40 p-5 shadow-sm">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-primary-500">
                        {item.icon}
                      </div>
                      <div>
                        <span className="text-xs font-bold uppercase text-primary-400">{t('home.step', { step: item.step })}</span>
                        <h4 className="mt-0.5 font-bold text-deliivo-dark">{t(item.titleKey)}</h4>
                        <p className="mt-1 text-sm leading-relaxed text-deliivo-gray">{t(item.descriptionKey)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <h2 className="text-2xl font-bold text-deliivo-dark sm:text-3xl">
                {t('home.whyTitle')}
              </h2>
              <p className="mt-2 text-deliivo-gray">
                {t('home.whyCopy')}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {whyDeliivo.map((item) => (
                <div key={item.titleKey} className="flex flex-col gap-3 rounded-2xl bg-primary-50 p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center self-center rounded-xl bg-white shadow-sm">
                    {item.icon}
                  </div>
                  <h3 className="font-bold text-deliivo-dark">{t(item.titleKey)}</h3>
                  <p className="text-sm leading-relaxed text-deliivo-gray">{t(item.descriptionKey)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-primary-500 px-4 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl text-center">
            <h2 className="text-2xl font-extrabold text-white sm:text-3xl">
              {t('home.ctaTitle')}
            </h2>
            <p className="mx-auto mt-3 max-w-3xl text-orange-100">
              {t('home.ctaCopy')}
            </p>
            <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/search"
                className="inline-flex min-w-56 items-center justify-center rounded-full bg-white px-8 py-3 text-sm font-semibold text-primary-500 shadow-sm transition-colors hover:bg-orange-50"
              >
                {t('home.findRide')}
              </Link>
              <Link
                href="/publish"
                className="inline-flex min-w-56 items-center justify-center rounded-full border border-white/50 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                {t('home.publishRoute')}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

export default HomepageV2;

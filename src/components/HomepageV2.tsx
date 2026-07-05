'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, CalendarCheck, Car, CreditCard, Headphones, MapPin, Navigation, Route, Search, ShieldCheck, Star, Tags, Users, Wallet } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SearchForm from '@/components/SearchForm';
import { contentApi, ContentPost } from '@/lib/api';
import { useTranslation } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';

const featuredRoutes = [
  { from: 'Tallinn', to: 'Tartu', price: 12, duration: '2h 20m', drivers: 12, rating: 4.9 },
  { from: 'Riga', to: 'Vilnius', price: 16, duration: '4h 10m', drivers: 8, rating: 4.8 },
  { from: 'Vilnius', to: 'Kaunas', price: 7, duration: '1h 20m', drivers: 15, rating: 4.9 },
];

const riderSteps = [
  { icon: Search, titleKey: 'home.riderStep1Title', copyKey: 'home.riderStep1Copy' },
  { icon: CreditCard, titleKey: 'home.riderStep2Title', copyKey: 'home.riderStep2Copy' },
  { icon: CalendarCheck, titleKey: 'home.riderStep3Title', copyKey: 'home.riderStep3Copy' },
];

const driverSteps = [
  { icon: Route, titleKey: 'home.driverStep1Title', copyKey: 'home.driverStep1Copy' },
  { icon: Users, titleKey: 'home.driverStep2Title', copyKey: 'home.driverStep2Copy' },
  { icon: Wallet, titleKey: 'home.driverStep3Title', copyKey: 'home.driverStep3Copy' },
];

const benefits = [
  { icon: ShieldCheck, titleKey: 'home.verifiedDrivers', copyKey: 'home.verifiedDriversCopy' },
  { icon: Star, titleKey: 'home.trustedCommunity', copyKey: 'home.trustedCommunityCopy' },
  { icon: Users, titleKey: 'home.womenOnlyOption', copyKey: 'home.womenOnlyOptionCopy' },
  { icon: Tags, titleKey: 'home.transparentPricing', copyKey: 'home.transparentPricingCopy' },
  { icon: Navigation, titleKey: 'home.regionalFares', copyKey: 'home.regionalFaresCopy' },
  { icon: Headphones, titleKey: 'home.support247', copyKey: 'home.support247Copy' },
];

export default function HomepageV2() {
  const { t, locale } = useTranslation();
  const { user } = useAuth();
  const [latestPosts, setLatestPosts] = useState<ContentPost[]>([]);

  useEffect(() => {
    contentApi.listPublished(locale)
      .then((response) => setLatestPosts((response.data || []).slice(0, 3)))
      .catch(() => setLatestPosts([]));
  }, [locale]);

  return (
    <div className="flex min-h-full w-full min-w-0 flex-col overflow-x-hidden bg-[#fbfaf8]">
      <Navbar />
      <main className="min-w-0 flex-1">
        <section className="relative isolate overflow-hidden border-b border-orange-100/70 bg-[#fffaf5]">
          <Image src="/baltic-hero-v2.png" alt="A car travelling toward a Baltic old-town skyline" fill priority sizes="100vw" className="-z-20 object-cover object-[66%_center] opacity-55 sm:opacity-70 lg:opacity-100" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#fffaf5] via-[#fffaf5]/95 to-[#fffaf5]/10 lg:via-[#fffaf5]/76" />
          <div className="mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 sm:pb-10 sm:pt-10 lg:px-8 lg:pt-12">
            <div className="min-w-0 max-w-3xl overflow-hidden">
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/90 px-4 py-2 text-sm font-semibold text-deliivo-orange shadow-sm backdrop-blur"><MapPin className="h-4 w-4" />{t('home.region')}</span>
              <h1 className="mt-4 max-w-3xl break-words text-[2.15rem] font-black leading-[1.04] tracking-[-0.04em] text-deliivo-dark sm:text-5xl lg:text-6xl">{t('home.heroTitle')}</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-deliivo-gray sm:text-lg">{t('home.heroCopy')}</p>
              {user && <p className="mt-4 text-sm font-bold text-deliivo-dark">Welcome back, {user.name || user.nickName || 'rider'}.</p>}
            </div>
            <div className="mt-6 min-w-0 max-w-6xl">
              <SearchForm variant="hero" />
              <div className="mt-3 grid gap-2 rounded-2xl border border-white/80 bg-white/85 p-3 text-xs font-semibold text-deliivo-gray shadow-sm backdrop-blur sm:grid-cols-4 sm:text-sm">
                <span className="flex items-center gap-2"><Search className="h-4 w-4 text-deliivo-orange" />{t('home.searchFree')}</span>
                <span className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-deliivo-orange" />{t('home.securePayments')}</span>
                <span className="flex items-center gap-2"><Navigation className="h-4 w-4 text-deliivo-orange" />{t('home.liveRideTracking')}</span>
                <span className="flex items-center gap-2"><Headphones className="h-4 w-4 text-deliivo-orange" />{t('home.support247')}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-gray-100 bg-white px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-deliivo-orange">{t('home.corridor')}</p><h2 className="mt-2 text-3xl font-black tracking-tight text-deliivo-dark">{t('home.popularRoutes')}</h2><p className="mt-2 text-deliivo-gray">{t('home.popularRoutesCopy')}</p></div>
              <Link href="/search" className="inline-flex items-center gap-2 text-sm font-bold text-deliivo-orange">{t('home.seeAll')} <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="mt-7 grid gap-4 lg:grid-cols-3">
              {featuredRoutes.map((route, index) => (
                <Link key={`${route.from}-${route.to}`} href={`/search?from=${encodeURIComponent(route.from)}&to=${encodeURIComponent(route.to)}`} className="group min-w-0 overflow-hidden rounded-3xl border border-gray-200 bg-[#fbfaf8] transition hover:-translate-y-1 hover:border-orange-200 hover:shadow-xl">
                  <div className="relative h-24 overflow-hidden bg-orange-50">
                    <Image src="/baltic-hero-v2.png" alt="" fill sizes="(max-width: 1024px) 100vw, 33vw" className="object-cover opacity-90 transition duration-500 group-hover:scale-105" style={{ objectPosition: `${62 + index * 12}% 48%` }} />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#fbfaf8] to-transparent" />
                  </div>
                  <div className="min-w-0 p-5 pt-2">
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><div className="min-w-0"><p className="break-words text-xl font-black text-deliivo-dark">{route.from} <span className="text-deliivo-orange">→</span> {route.to}</p><p className="mt-2 text-sm text-deliivo-gray">{t('home.routeMeta', { drivers: route.drivers, duration: route.duration })}</p><div className="mt-2 flex items-center gap-1 text-xs font-bold text-deliivo-dark"><Star className="h-3.5 w-3.5 fill-deliivo-orange text-deliivo-orange" /> {route.rating}</div></div><span className="shrink-0 rounded-2xl bg-white px-3 py-2 text-right shadow-sm"><span className="block text-[10px] font-bold uppercase tracking-wide text-deliivo-gray">{t('home.from')}</span><span className="text-lg font-black text-deliivo-orange">EUR {route.price}</span></span></div>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-deliivo-orange">{t('home.exploreRoute')} <ArrowRight className="h-4 w-4" /></span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-24 bg-[#fbfaf8] px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="text-center"><p className="text-sm font-bold uppercase tracking-[0.18em] text-deliivo-orange">{t('home.simpleSafe')}</p><h2 className="mt-3 text-3xl font-black tracking-tight text-deliivo-dark sm:text-4xl">{t('home.howTitle')}</h2><p className="mt-3 text-deliivo-gray">{t('home.howCopy')}</p></div>
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {[{ title: t('home.forRiders'), icon: Users, items: riderSteps }, { title: t('home.forDrivers'), icon: Car, items: driverSteps }].map((group) => {
                const GroupIcon = group.icon;
                return <article key={group.title} className="rounded-[2rem] border border-gray-200 bg-white p-5 shadow-sm sm:p-7"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-deliivo-orange"><GroupIcon className="h-5 w-5" /></span><h3 className="text-xl font-black text-deliivo-dark">{group.title}</h3></div><div className="mt-6 grid gap-3 sm:grid-cols-3">{group.items.map((item, index) => { const Icon = item.icon; return <div key={item.titleKey} className="relative rounded-2xl bg-[#fbfaf8] p-4"><span className="absolute right-3 top-3 text-3xl font-black text-orange-100">{index + 1}</span><Icon className="relative h-5 w-5 text-deliivo-orange" /><h4 className="relative mt-4 font-black text-deliivo-dark">{t(item.titleKey)}</h4><p className="relative mt-2 text-xs leading-5 text-deliivo-gray">{t(item.copyKey)}</p></div>; })}</div></article>;
              })}
            </div>
          </div>
        </section>

        <section className="border-y border-gray-100 bg-white px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl"><div className="text-center"><p className="text-sm font-bold uppercase tracking-[0.18em] text-deliivo-orange">{t('home.travelSmarter')}</p><h2 className="mt-3 text-3xl font-black tracking-tight text-deliivo-dark sm:text-4xl">{t('home.whyTitle')}</h2><p className="mt-3 text-deliivo-gray">{t('home.whyCopy')}</p></div><div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{benefits.map((benefit) => { const Icon = benefit.icon; return <div key={benefit.titleKey} className="rounded-3xl border border-gray-200 bg-[#fbfaf8] p-6"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-deliivo-orange shadow-sm"><Icon className="h-6 w-6" /></span><h3 className="mt-5 text-lg font-black text-deliivo-dark">{t(benefit.titleKey)}</h3><p className="mt-2 text-sm leading-6 text-deliivo-gray">{t(benefit.copyKey)}</p></div>; })}</div></div>
        </section>

        {latestPosts.length > 0 && <section className="bg-[#fbfaf8] px-4 py-16 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl"><div className="flex items-end justify-between gap-4"><div><p className="text-sm font-bold uppercase tracking-[0.18em] text-deliivo-orange">{t('home.blogKicker')}</p><h2 className="mt-2 text-3xl font-black tracking-tight text-deliivo-dark">{t('home.latestGuidance')}</h2></div><Link href="/blog" className="hidden items-center gap-2 text-sm font-bold text-deliivo-orange sm:inline-flex">{t('home.allArticles')} <ArrowRight className="h-4 w-4" /></Link></div><div className="mt-7 grid gap-4 lg:grid-cols-3">{latestPosts.map((post) => <Link key={post.id} href={`/blog/${post.slug}`} className="group rounded-3xl border border-gray-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-xl"><span className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-deliivo-orange">{post.category.replace('guide', 'blog')}</span><h3 className="mt-5 text-xl font-black leading-tight text-deliivo-dark">{post.title}</h3><p className="mt-3 line-clamp-3 text-sm leading-6 text-deliivo-gray">{post.excerpt}</p><span className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-deliivo-orange">{t('home.readArticle')} <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span></Link>)}</div></div></section>}

        <section className="relative isolate overflow-hidden bg-[#ef6c21] px-4 py-9 sm:px-6 sm:py-10 lg:px-8"><Image src="/baltic-hero-v2.png" alt="" fill sizes="100vw" className="-z-20 object-cover object-[center_58%] opacity-45" /><div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#d94f0b]/95 via-[#ef6c21]/80 to-[#d94f0b]/90" /><div className="relative mx-auto max-w-4xl text-center"><h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{t('home.balancedCtaTitle')}</h2><p className="mx-auto mt-2 max-w-2xl text-sm text-orange-50 sm:text-base">{t('home.balancedCtaCopy')}</p><div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/search" className="inline-flex min-w-48 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-deliivo-orange shadow-lg">{t('home.findRide')} <ArrowRight className="h-4 w-4" /></Link><Link href="/publish" className="inline-flex min-w-48 items-center justify-center gap-2 rounded-full border border-white/70 px-6 py-3 text-sm font-black text-white">{t('home.publishRoute')} <ArrowRight className="h-4 w-4" /></Link></div></div></section>
      </main>
      <Footer />
    </div>
  );
}

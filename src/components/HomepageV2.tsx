'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Calendar, CalendarCheck, Car, CreditCard, Headphones, MapPin, Navigation, Route, Search, ShieldCheck, Star, Tags, Users, Wallet } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SearchForm from '@/components/SearchForm';
import { useTranslation } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';
import { SearchRideResult, searchRidesApi } from '@/lib/api';
import { useEffect, useState } from 'react';

const featuredRoutes = [
  { from: 'Tallinn', to: 'Tartu', price: 12, duration: '2h 20m', drivers: 12 },
  { from: 'Riga', to: 'Vilnius', price: 16, duration: '4h 10m', drivers: 8 },
  { from: 'Vilnius', to: 'Kaunas', price: 7, duration: '1h 20m', drivers: 15 },
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

const quickSearches = [
  ['Tallinn', 'Tartu'],
  ['Vilnius', 'Kaunas'],
  ['Riga', 'Tallinn'],
  ['Tallinn', 'Riga'],
];

function shortPlace(address: string) {
  return address.split(',')[0]?.trim() || address;
}

function UpcomingRidesRail() {
  const [rides, setRides] = useState<SearchRideResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    searchRidesApi.available(1, 3)
      .then((response) => setRides(response.data?.rides || []))
      .catch(() => setRides([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <aside className="overflow-hidden rounded-[1.75rem] border border-orange-100 bg-[#fffdfa]/95 p-4 shadow-[0_20px_50px_rgba(70,40,15,0.14)] backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-deliivo-orange"><Search className="h-4 w-4" /></span>
        <div><p className="text-xs font-black uppercase tracking-[0.14em] text-deliivo-orange">Explore routes</p><h2 className="text-base font-black text-deliivo-dark">Where to next?</h2></div>
      </div>
      <div className="mt-3 divide-y divide-orange-100 rounded-2xl border border-orange-100 bg-white px-3">
        {quickSearches.map(([from, to]) => (
          <Link key={`${from}-${to}`} href={`/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`} className="flex items-center justify-between gap-2 py-2.5 text-sm font-semibold text-deliivo-dark transition hover:text-deliivo-orange">
            <span className="min-w-0 truncate">{from} <span className="text-deliivo-orange">to</span> {to}</span><ArrowRight className="h-4 w-4 shrink-0 text-deliivo-orange" />
          </Link>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between"><h2 className="text-sm font-black text-deliivo-dark">Upcoming rides</h2><Link href="/search" className="text-xs font-bold text-deliivo-orange hover:underline">View all</Link></div>
      <div className="mt-3 space-y-2">
        {loading ? (
          <div className="space-y-2" aria-label="Loading upcoming rides"><div className="h-16 animate-pulse rounded-2xl bg-orange-50" /><div className="h-16 animate-pulse rounded-2xl bg-orange-50" /></div>
        ) : rides.length ? rides.map((ride) => {
          const departure = new Date(ride.departureDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const driverName = ride.driver?.firstName || 'Driver';
          return (
            <Link key={ride.id} href={`/rides/${ride.id}`} className="block rounded-2xl border border-gray-100 bg-white p-3 transition hover:border-orange-200 hover:shadow-sm">
              <div className="flex items-start gap-2.5"><div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-100 text-xs font-black text-deliivo-orange">{ride.driver?.avatarUrl ? <img src={ride.driver.avatarUrl} alt="" className="h-full w-full object-cover" /> : driverName.slice(0, 1)}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-black text-deliivo-dark">{shortPlace(ride.originAddress)} <span className="text-deliivo-orange">to</span> {shortPlace(ride.destinationAddress)}</p><span className="shrink-0 text-xs font-black text-deliivo-orange">{ride.currency} {ride.basePricePerSeat}</span></div><p className="mt-1 flex items-center gap-1 text-xs text-deliivo-gray"><Calendar className="h-3 w-3" />{departure}, {ride.departureTime} <span className="mx-1">|</span> {ride.availableSeats} seats</p></div></div>
            </Link>
          );
        }) : <p className="rounded-2xl bg-orange-50 px-3 py-4 text-center text-xs leading-5 text-deliivo-gray">New rides will appear here as drivers publish them.</p>}
      </div>
    </aside>
  );
}

export default function HomepageV2() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="flex min-h-full w-full min-w-0 flex-col overflow-x-hidden bg-[#fbfaf8]">
      <Navbar />
      <main className="min-w-0 flex-1">
        <section className="relative isolate overflow-hidden border-b border-orange-100/70 bg-[#fffaf5]">
          <Image src="/baltic-hero-v2.png" alt="A car travelling toward a Baltic old-town skyline" fill priority sizes="100vw" className="-z-20 object-cover object-[66%_center] opacity-55 sm:opacity-70 lg:opacity-100" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#fffaf5] via-[#fffaf5]/95 to-[#fffaf5]/10 lg:via-[#fffaf5]/76" />
          <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-6 pt-6 sm:px-6 sm:pb-10 sm:pt-10 lg:px-8 lg:pt-12 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0">
              <div className="mb-3 flex flex-col gap-2.5 sm:mb-4 sm:flex-row sm:items-start sm:justify-between">
                <span className="inline-flex items-center gap-2 self-start rounded-full border border-orange-200 bg-white/90 px-3.5 py-2 text-[13px] font-semibold text-deliivo-orange shadow-sm backdrop-blur sm:px-4 sm:text-sm"><MapPin className="h-4 w-4" />{t('home.region')}</span>
                {user && <p className="inline-flex self-start rounded-lg border border-orange-200 bg-white/90 px-3 py-1.5 text-[13px] font-semibold text-deliivo-dark shadow-sm backdrop-blur sm:text-sm">Welcome back, {user.firstName || 'rider'}.</p>}
              </div>
              <div className="min-w-0 max-w-3xl overflow-hidden">
                <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-deliivo-orange">People. Places. A brighter tomorrow.</p>
                <h1 className="max-w-3xl break-words text-[2.15rem] font-black leading-[1.02] tracking-[-0.045em] text-deliivo-dark sm:text-5xl lg:text-6xl">{t('home.heroTitle')}</h1>
                <p className="mt-3 max-w-2xl text-[15px] leading-7 text-deliivo-gray sm:mt-4 sm:text-lg">{t('home.heroCopy')}</p>
                <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-deliivo-dark sm:text-sm">
                  <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-deliivo-orange" /> Verified drivers</span>
                  <span className="inline-flex items-center gap-1.5"><CreditCard className="h-4 w-4 text-deliivo-orange" /> Secure payments</span>
                  <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-deliivo-orange" /> Real people, real routes</span>
                </div>
              </div>
              <div className="mt-5 min-w-0 sm:mt-6"><SearchForm variant="hero" /></div>
              <div className="mt-3 grid gap-2 rounded-2xl border border-white/80 bg-white/85 p-3 text-xs font-semibold text-deliivo-gray shadow-sm backdrop-blur sm:grid-cols-4 sm:text-sm">
                <span className="flex items-center gap-2"><Search className="h-4 w-4 text-deliivo-orange" />{t('home.searchFree')}</span>
                <span className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-deliivo-orange" />{t('home.securePayments')}</span>
                <span className="flex items-center gap-2"><Navigation className="h-4 w-4 text-deliivo-orange" />{t('home.liveRideTracking')}</span>
                <span className="flex items-center gap-2"><Headphones className="h-4 w-4 text-deliivo-orange" />{t('home.support247')}</span>
              </div>
            </div>
            <div className="self-center"><UpcomingRidesRail /></div>
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
                    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><div className="min-w-0"><p className="break-words text-xl font-black text-deliivo-dark">{route.from} <span className="text-deliivo-orange">→</span> {route.to}</p><p className="mt-2 text-sm text-deliivo-gray">{t('home.routeMeta', { drivers: route.drivers, duration: route.duration })}</p></div><span className="shrink-0 rounded-2xl bg-white px-3 py-2 text-right shadow-sm"><span className="block text-[10px] font-bold uppercase tracking-wide text-deliivo-gray">{t('home.from')}</span><span className="text-lg font-black text-deliivo-orange">EUR {route.price}</span></span></div>
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

        <section className="relative isolate overflow-hidden bg-[#ef6c21] px-4 py-9 sm:px-6 sm:py-10 lg:px-8"><Image src="/baltic-hero-v2.png" alt="" fill sizes="100vw" className="-z-20 object-cover object-[center_58%] opacity-45" /><div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#d94f0b]/95 via-[#ef6c21]/80 to-[#d94f0b]/90" /><div className="relative mx-auto max-w-4xl text-center"><h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{t('home.balancedCtaTitle')}</h2><p className="mx-auto mt-2 max-w-2xl text-sm text-orange-50 sm:text-base">{t('home.balancedCtaCopy')}</p><div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row"><Link href="/search" className="inline-flex min-w-48 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-black text-deliivo-orange shadow-lg">{t('home.findRide')} <ArrowRight className="h-4 w-4" /></Link><Link href="/publish" className="inline-flex min-w-48 items-center justify-center gap-2 rounded-full border border-white/70 px-6 py-3 text-sm font-black text-white">{t('home.publishRoute')} <ArrowRight className="h-4 w-4" /></Link></div></div></section>
      </main>
      <Footer />
    </div>
  );
}

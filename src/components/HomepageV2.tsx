'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft, ArrowRight, Bell, CalendarDays, Car, Check, ChevronRight,
  CreditCard, Flame, Headphones, Heart, Leaf, Loader2, MapPin,
  Navigation, Search, ShieldCheck, Smartphone, Star, Users, Wallet,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SearchForm from '@/components/SearchForm';
import { useTranslation } from '@/lib/i18n-context';
import { useAuth } from '@/lib/auth-context';
import { contentApi, searchRidesApi, type SearchRideResult } from '@/lib/api';
import styles from './HomepageV2.module.css';
import { rideRequestsEnabled } from '@/lib/ride-requests';

const routes = [
  { from: 'Tallinn', to: 'Tartu', image: 'tallinn', copy: 'From the capital to the university city' },
  { from: 'Riga', to: 'Vilnius', image: 'riga', copy: 'Two capitals, one shared journey' },
  { from: 'Vilnius', to: 'Kaunas', image: 'kaunas', copy: 'A little closer to your next adventure' },
  { from: 'Tallinn', to: 'Riga', image: 'riga', copy: 'Follow the road along the Baltic coast' },
];
const destinations = [
  { name: 'Tallinn', caption: 'Medieval charm', image: 'tallinn' },
  { name: 'Riga', caption: 'Art & architecture', image: 'riga' },
  { name: 'Vilnius', caption: 'History & culture', image: 'vilnius' },
  { name: 'Kaunas', caption: 'A fresh perspective', image: 'kaunas' },
  { name: 'Beyond the Baltics', caption: 'New horizons', image: 'lake_bled', href: '/search' },
];

function routeUrl(from: string, to?: string) {
  const query = new URLSearchParams({ from });
  if (to) query.set('to', to);
  return `/search?${query}`;
}

// departureTime arrives as a 24-hour "HH:mm" string; show it as 12-hour with AM/PM.
function formatDepartureTime(time: string, locale: string) {
  const [hours, minutes] = time.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return time;
  return new Date(Date.UTC(1970, 0, 1, hours, minutes)).toLocaleTimeString(locale, {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC',
  });
}

function UpcomingRidesRail() {
  const { locale } = useTranslation();
  const [rides, setRides] = useState<SearchRideResult[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    searchRidesApi.available(page, 2)
      .then(({ data }) => {
        if (!active) return;
        setRides(data.rides || []);
        setTotalPages(Math.max(1, data.pagination.totalPages));
      })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, attempt]);

  return (
    <aside className={styles.rail} aria-label="Find upcoming rides">
      <div className={styles.railHeading}>
        <span className={styles.iconDisc}><Flame size={23} /></span>
        <h2>Find your next<br />carpool ride</h2>
      </div>
      <div className={styles.quickRoutes}>
        {routes.map(({ from, to }) => (
          <Link key={from + to} href={routeUrl(from, to)}><Search size={15} /><span>{from} to {to}</span><ChevronRight size={16} /></Link>
        ))}
        <Link href={routeUrl('Tallinn', 'Kaunas')}><Search size={15} /><span>Tallinn to Kaunas</span><ChevronRight size={16} /></Link>
      </div>
      <h3 className={styles.railSubheading}>Upcoming rides</h3>
      <div className={styles.liveRides} aria-live="polite" aria-busy={loading}>
        {loading ? <div className={styles.railMessage}><Loader2 size={19} className="animate-spin" /> Loading rides...</div>
          : failed ? <div className={styles.railMessage}><p>Rides could not be loaded.</p><button onClick={() => setAttempt(attempt + 1)}>Try again</button></div>
          : rides.length === 0 ? <div className={styles.railMessage}><Car size={24} /><p>No upcoming rides yet.<br />Be the first to offer a seat.</p><Link href="/publish">Publish a ride <ArrowRight size={14} /></Link></div>
          : rides.map((ride) => (
            <Link key={`${ride.id}-${ride.segmentId || ''}`} className={styles.liveRide} href={`/rides/${ride.id}${ride.segmentId ? `?segmentId=${encodeURIComponent(ride.segmentId)}` : ''}`}>
              <span className={styles.avatar}>{ride.driver?.avatarUrl ? <img src={ride.driver.avatarUrl} alt="" /> : (ride.driver?.firstName || 'D').slice(0, 1)}</span>
              <span className={styles.rideInfo}>
                <strong>{ride.originAddress.split(',')[0]} <ArrowRight size={12} /> {ride.destinationAddress.split(',')[0]}</strong>
                <span><Car size={12} /> {[ride.vehicle?.brand, ride.vehicle?.model_name].filter(Boolean).join(' ') || 'Carpool'} <span>{ride.availableSeats} seats</span></span>
                <span><CalendarDays size={12} /> {new Date(ride.departureDate).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })}, {formatDepartureTime(ride.departureTime, locale)}</span>
                <b>{new Intl.NumberFormat(locale, { style: 'currency', currency: ride.currency || 'EUR' }).format(ride.segment?.segmentFare ?? ride.basePricePerSeat)} <small>/ seat</small></b>
              </span>
            </Link>
          ))}
      </div>
      {totalPages > 1 && <div className={styles.pagination}>
        <button aria-label="Previous rides" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}><ArrowLeft size={15} /></button>
        <span>{page} / {totalPages}</span>
        <button aria-label="Next rides" disabled={page === totalPages || loading} onClick={() => setPage(page + 1)}><ArrowRight size={15} /></button>
      </div>}
      <Link href="/search" className={styles.railMore}>View all rides <ArrowRight size={15} /></Link>
    </aside>
  );
}

function AppUpdates() {
  const { locale, t } = useTranslation();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  async function subscribe(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('saving');
    try { await contentApi.subscribeNewsletter(email.trim(), locale); setStatus('saved'); }
    catch { setStatus('error'); }
  }

  return (
    <section className={`${styles.container} ${styles.appSection}`} aria-labelledby="app-title">
      <div className={styles.phoneScene} aria-hidden="true">
        <div className={`${styles.phone} ${styles.phoneBack}`}><span className={styles.notch} /><b>Deliivo</b><h3>Travel together.<br />Go further.</h3><div className={styles.mockSearch}><MapPin size={13} /> Tallinn <ArrowRight size={13} /> Riga</div><span className={styles.mockButton}>Find your next ride</span></div>
        <div className={`${styles.phone} ${styles.phoneFront}`}><span className={styles.notch} /><b>Deliivo</b><p>People. Places.<br />A brighter tomorrow.</p><Car size={36} /><span>More than<br />just a ride.</span></div>
      </div>
      <div className={styles.appCopy}>
        <span className={styles.badge}>Mobile app launching soon</span>
        <h2 id="app-title">Your next ride.<br />Soon in your pocket.</h2>
        <p>The Deliivo mobile app is on its way. Subscribe for launch news and updates. Until then, find and share rides right here on our website.</p>
        <form onSubmit={subscribe} className={styles.subscribe}>
          <label className="sr-only" htmlFor="home-updates-email">Your email address</label>
          <input id="home-updates-email" type="email" autoComplete="email" placeholder="Enter your email" required value={email} onChange={(event) => { setEmail(event.target.value); setStatus('idle'); }} disabled={status === 'saving' || status === 'saved'} />
          <button type="submit" disabled={status === 'saving' || status === 'saved'}>{status === 'saving' ? 'Subscribing...' : status === 'saved' ? 'Subscribed' : 'Notify me'}</button>
        </form>
        <p className={styles.consent}>By subscribing, you agree to receive Deliivo news, including mobile app launch updates, by email. Unsubscribe anytime. <Link href="/privacy">Privacy policy</Link>.</p>
        <p role="status" className={styles.formStatus}>{status === 'saved' ? t('blog.newsletterSuccess') : status === 'error' ? t('blog.newsletterError') : ''}</p>
      </div>
      <div className={styles.appPerks}>
        <div><span className={styles.iconDisc}><Bell /></span><p><strong>Stay updated on the launch</strong><span>App news straight to your inbox</span></p></div>
        <div><span className={styles.iconDisc}><MapPin /></span><p><strong>A little travel inspiration</strong><span>Discover your next destination</span></p></div>
        <div><span className={styles.iconDisc}><Smartphone /></span><p><strong>Coming soon to mobile</strong><span>Your shared journeys, on the go</span></p></div>
      </div>
    </section>
  );
}

export default function HomepageV2() {
  const { t, locale } = useTranslation();
  const { user } = useAuth();
  const benefits = [
    { icon: Wallet, title: 'Lower travel costs', copy: 'Share the cost of getting there' },
    { icon: Leaf, title: 'A cleaner planet', copy: 'More shared seats, fewer cars' },
    { icon: Users, title: 'A connected community', copy: 'Meet people along the way' },
    { icon: Heart, title: 'Travel with confidence', copy: 'Verified users and secure payments' },
  ];
  const steps = [
    { icon: Search, title: 'Find a ride', copy: 'Enter your route and travel date.' },
    { icon: CalendarDays, title: 'Book your seat', copy: 'Choose your driver and pay securely.' },
    { icon: Car, title: 'Meet and travel', copy: 'Meet at the pickup point and enjoy the ride.' },
    { icon: Star, title: 'Rate and repeat', copy: 'Share your experience and travel again.' },
  ];

  return (
    <div className={styles.home}>
      <Navbar home />
      <main>
        <section className={styles.hero}>
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.heroMain}>
              <p className={styles.eyebrow}>People. Places. A brighter tomorrow.</p>
              <h1>{locale === 'en' ? <>Carpool the <em>Baltics</em><br />and Beyond</> : t('home.heroTitle')}</h1>
              <p className={styles.heroCopy}>{t('home.heroCopy')}</p>
              <div className={styles.trust}>
                <div><ShieldCheck /><p><strong>Verified users</strong><span>Travel with trust</span></p></div>
                <div><CreditCard /><p><strong>Secure payments</strong><span>Money stays safe</span></p></div>
                <div><Users /><p><strong>Real people, real routes</strong><span>A shared way to travel</span></p></div>
              </div>
              <div className={styles.heroArt}><Image src="/home/hero-friends.png" alt="Three friends sharing a journey beside their car overlooking Tallinn" fill priority sizes="(max-width: 799px) 100vw, 1440px" /></div>
              <p className={styles.heroNote} aria-hidden="true">Same roads<br />Brighter stories</p>
              <span className={styles.journeyTag} aria-hidden="true">Good<br />people<br />Great<br />journeys<Heart size={17} /></span>
              <div className={styles.heroSearch}><SearchForm variant="landing" /></div>
              {rideRequestsEnabled && <Link href="/ride-requests/new" className="relative z-10 mt-3 inline-block rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-deliivo-orange shadow-sm">Cannot find a ride? Request one →</Link>}
              <div className={styles.searchBenefits}>
                {[{ icon: Search, key: 'home.searchFree' }, { icon: CreditCard, key: 'home.securePayments' }, { icon: Navigation, key: 'home.liveRideTracking' }, { icon: Headphones, key: 'nav.support' }].map(({ icon: Icon, key }) => <span key={key}><Icon size={18} />{t(key)}</span>)}
              </div>
            </div>
            <UpcomingRidesRail />
          </div>
        </section>

        <section className={`${styles.container} ${styles.routes}`}>
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>{t('home.corridor')}</p><h2>{t('home.popularRoutes')}</h2><p>{t('home.popularRoutesCopy')}</p></div>
            <Link href="/search" className={styles.textLink}>{t('home.seeAll')} <ArrowRight size={16} /></Link>
          </div>
          <div className={styles.routeGrid}>
            {routes.map((route) => <Link key={route.from + route.to} href={routeUrl(route.from, route.to)} className={styles.routeCard}>
              <div className={styles.routeImage}><Image src={`/home/${route.image}.jpg`} alt={`${route.image} city view`} fill sizes="(max-width: 600px) 90vw, (max-width: 900px) 45vw, 25vw" /></div>
              <div className={styles.routeBody}><h3>{route.from} <ArrowRight size={17} /> {route.to}</h3><p>{route.copy}</p><span>{t('home.exploreRoute')} <ArrowRight size={14} /></span></div>
            </Link>)}
          </div>
        </section>

        <section className={styles.benefits} aria-label="Why carpool with Deliivo"><div className={`${styles.container} ${styles.benefitGrid}`}>
          {benefits.map(({ icon: Icon, title, copy }) => <div key={title}><Icon size={35} /><p><strong>{title}</strong><span>{copy}</span></p></div>)}
        </div></section>

        <section id="how-it-works" className={`${styles.container} ${styles.how}`}>
          <div className={styles.centerHeading}><p className={styles.eyebrow}>Simple steps, bigger journeys</p><h2>{t('home.howTitle')}</h2><p>From search to the road, it&apos;s simple.</p></div>
          <div className={styles.steps}>{steps.map(({ icon: Icon, title, copy }, index) => <article key={title}>
            <div className={styles.stepTop}><span className={styles.iconDisc}><Icon size={31} /></span><span>{index + 1}</span></div>
            <h3>{title}</h3><p>{copy}</p>{index < steps.length - 1 && <ChevronRight className={styles.stepArrow} size={22} />}
          </article>)}</div>
          <p className={styles.driverNote}>Already heading that way? <Link href="/publish">Offer your spare seats <ArrowRight size={14} /></Link></p>
        </section>

        <section className={styles.journey}>
          <Image src="/home/lake_bled.jpg" alt="A lake and mountains in Europe" fill sizes="100vw" />
          <div className={`${styles.container} ${styles.journeyContent}`}>
            <p className={styles.handwritten}>More than<br />just a ride</p>
            <div><h2>Make your next journey a shared one</h2><Link href={user ? '/publish' : '/auth/signup'} className={styles.primary}><Users size={21} />{user ? t('home.publishRoute') : 'Register now'}<ArrowRight size={19} /></Link><p><span><Check size={17} />Free to join</span><span><Check size={17} />Quick signup</span><span><Check size={17} />Start exploring</span></p></div>
            <div className={styles.signpost} aria-hidden="true"><span>Tallinn</span><span>Riga</span><span>Vilnius</span><span>And beyond</span></div>
          </div>
        </section>

        <section className={styles.experiences}><div className={styles.container}>
          <div className={styles.centerHeading}><p className={styles.eyebrow}>A seat for every kind of journey</p><h2>Small journeys. More possibilities.</h2></div>
          <div className={styles.experienceGrid}>{[
            { icon: Wallet, title: 'Your everyday commute', copy: 'Share the journey, split the cost and make your regular route a little more social.', from: 'Tallinn', to: 'Tartu' },
            { icon: Users, title: 'A weekend with friends', copy: 'Spend less time planning how to get there and more time with the people you came to see.', from: 'Vilnius', to: 'Kaunas' },
            { icon: Heart, title: 'Somewhere new', copy: 'A new city, a shared ride and a chance to meet someone along the way.', from: 'Riga', to: 'Tallinn' },
          ].map(({ icon: Icon, title, copy, from, to }) => <article key={title}><span className={styles.iconDisc}><Icon /></span><div><h3>{title}</h3><p>{copy}</p><Link href={routeUrl(from, to)}>{from} <ArrowRight size={13} /> {to}</Link></div></article>)}</div>
        </div></section>

        <section id="destinations" className={`${styles.container} ${styles.destinations}`}>
          <div><p className={styles.eyebrow}>Explore beyond</p><h2>Discover amazing destinations</h2><p>From historic cities to hidden gems, there&apos;s so much to discover. Carpool, explore and make your next journey unforgettable.</p><Link href="/search" className={styles.primary}>Explore destinations <ArrowRight size={16} /></Link></div>
          <div className={styles.destinationGrid}>{destinations.map(({ name, caption, image, href }) => <Link key={name} href={href || routeUrl(name)} className={styles.destination}>
            <Image src={`/home/${image}.jpg`} alt="" fill sizes="(max-width: 600px) 40vw, 15vw" /><span><strong>{name}</strong><small>{caption}</small></span>
          </Link>)}</div>
        </section>
        <AppUpdates />
      </main>
      <Footer light />
    </div>
  );
}

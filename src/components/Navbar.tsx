'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, X, ChevronDown, User, LogOut, Car, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslation } from "@/lib/i18n-context";
import { useNotificationStore } from "@/lib/notification-store";
import BrandLogo from "@/components/BrandLogo";
import { prefetchHref, useRoutePrefetch } from "@/lib/use-route-prefetch";
import { rewardsApi } from "@/lib/api";

export default function Navbar() {
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const { t } = useTranslation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletCurrency, setWalletCurrency] = useState('EUR');
  const { unreadCount } = useNotificationStore(user?.id);

  type NavLink = {
    label: string;
    href: string;
    badge?: number;
  };

  const rideLinks: NavLink[] = [
    { label: t('nav.searchRide'), href: "/search" },
    { label: t('nav.offerRide'), href: "/publish" },
  ];
  const publicLinks: NavLink[] = [
    ...rideLinks,
    { label: t('nav.howItWorks'), href: "/#how-it-works" },
    { label: t('nav.guides'), href: "/blog" },
    { label: t('nav.support'), href: "/contact" },
  ];
  const authenticatedLinks: NavLink[] = [
    { label: t('nav.yourRides'), href: "/rides" },
    { label: t('nav.notifications'), href: "/profile/notifications", badge: unreadCount > 0 ? unreadCount : 0 },
  ];
  const navLinks = user ? [...rideLinks, ...authenticatedLinks] : publicLinks;
  useRoutePrefetch([
    ...navLinks.map((link) => link.href),
    "/",
    "/blog",
    "/contact",
    "/faq",
    "/terms",
    "/privacy",
  ]);

  useEffect(() => {
    if (!user) {
      setWalletBalance(null);
      setWalletCurrency('EUR');
      return;
    }

    let active = true;
    rewardsApi.getMyWallet()
      .then((res) => {
        if (!active) return;
        const balance = res.data.totals.reduce((sum, total) => sum + total.balance, 0);
        setWalletBalance(balance);
        setWalletCurrency(res.data.totals[0]?.currency || 'EUR');
      })
      .catch(() => {
        if (!active) return;
        setWalletBalance(null);
      });

    return () => {
      active = false;
    };
  }, [user]);

  return (
    <header className="sticky top-0 z-50 w-full bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center shrink-0">
          <BrandLogo size={35} className="h-8 w-auto object-contain" />
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onMouseEnter={() => prefetchHref(router, link.href)}
                  onFocus={() => prefetchHref(router, link.href)}
                  className="flex items-center gap-2 text-sm font-medium text-deliivo-gray transition-colors hover:text-deliivo-orange"
                >
              {link.label}
              {link.badge ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-deliivo-orange px-1.5 py-0.5 text-[10px] font-semibold text-white">{link.badge}</span> : null}
                </Link>
              ))}
        </nav>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-3">
          {user && walletBalance !== null ? (
            <Link
              href="/profile/wallet"
              className="inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-sm font-semibold text-deliivo-orange hover:bg-orange-100"
            >
              <Wallet size={14} />
              {walletCurrency} {walletBalance.toFixed(2)}
            </Link>
          ) : null}
          <LanguageSwitcher compact />
          {loading ? (
            <div className="h-8 w-24 animate-pulse rounded-full bg-gray-100" />
          ) : user ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-deliivo-dark hover:bg-gray-50 transition-colors"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <User size={14} />
                  )}
                </span>
                <span className="max-w-[120px] truncate">{user.firstName || user.email || 'User'}</span>
                <ChevronDown size={14} className={`transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white py-1 shadow-lg ring-1 ring-black/5">
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-deliivo-dark hover:bg-primary-50"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <User size={14} />
                    {t('nav.myProfile')}
                  </Link>
                  <Link
                    href="/rides"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-deliivo-dark hover:bg-primary-50"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <Car size={14} />
                    {t('nav.myRides')}
                  </Link>
                  <Link
              href="/profile/wallet"
                    className="flex items-center gap-2 px-4 py-2 text-sm text-deliivo-dark hover:bg-primary-50"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <Wallet size={14} />
                    Wallet
                  </Link>
                  {user.role === 'ADMIN' && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-deliivo-dark hover:bg-primary-50"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <span className="text-xs">{t('nav.admin')}</span>
                    </Link>
                  )}
                  <hr className="my-1 border-gray-100" />
                  <button
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-500 hover:bg-red-50"
                    onClick={() => { setDropdownOpen(false); logout(); }}
                  >
                    <LogOut size={14} />
                    {t('nav.signOut')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/auth/signin" className="btn-outline py-2 px-5 text-sm">
                {t('nav.signIn')}
              </Link>
              <Link href="/auth/signup" className="btn-primary py-2 px-5 text-sm">
                {t('nav.signUp')}
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden rounded-lg p-2 text-deliivo-gray hover:bg-gray-100 transition-colors"
          onClick={() => setMobileOpen((prev) => !prev)}
          aria-label={t('nav.toggleMenu')}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label={t('nav.toggleMenu')}
            className="absolute inset-0 bg-[#1a1a2e]/30 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute right-0 top-0 flex h-full w-full max-w-[22rem] flex-col border-l border-orange-100 bg-white px-4 pb-5 pt-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <BrandLogo size={30} className="h-7 w-auto object-contain" />
              <button
                type="button"
                className="rounded-lg p-2 text-deliivo-gray transition-colors hover:bg-gray-100"
                onClick={() => setMobileOpen(false)}
                aria-label={t('nav.toggleMenu')}
              >
                <X size={20} />
              </button>
            </div>

            <nav className="mt-4 grid gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onMouseEnter={() => prefetchHref(router, link.href)}
                  onFocus={() => prefetchHref(router, link.href)}
                  className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-medium text-deliivo-dark transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-deliivo-orange"
                  onClick={() => setMobileOpen(false)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{link.label}</span>
                    {link.badge ? <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-deliivo-orange px-1.5 py-0.5 text-[10px] font-semibold text-white">{link.badge}</span> : null}
                  </div>
                </Link>
              ))}
            </nav>

            <div className="mt-4">
              <LanguageSwitcher />
            </div>

            {user && walletBalance !== null ? (
              <Link
              href="/profile/wallet"
                className="mt-4 flex items-center justify-between rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-semibold text-deliivo-orange"
                onClick={() => setMobileOpen(false)}
              >
                <span className="flex items-center gap-2">
                  <Wallet size={14} />
                  Wallet
                </span>
                <span>{walletCurrency} {walletBalance.toFixed(2)}</span>
              </Link>
            ) : null}

            <div className="mt-auto grid gap-2 pt-6">
              {user ? (
                <>
                  <Link
                    href="/profile"
                    className="btn-outline w-full text-center"
                    onClick={() => setMobileOpen(false)}
                  >
                    {t('nav.myProfile')}
                  </Link>
                  <button
                    className="btn-outline w-full border-red-200 text-center text-red-500"
                    onClick={() => { setMobileOpen(false); logout(); }}
                  >
                    {t('nav.signOut')}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/signin"
                    className="btn-outline w-full text-center"
                    onClick={() => setMobileOpen(false)}
                  >
                    {t('nav.signIn')}
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="btn-primary w-full text-center"
                    onClick={() => setMobileOpen(false)}
                  >
                    {t('nav.signUp')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

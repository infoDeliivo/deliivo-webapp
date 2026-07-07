'use client';

import Link from "next/link";
import Image from "next/image";
import { useTranslation } from "@/lib/i18n-context";
import { publicConfig } from "@/lib/public-config";
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaTiktok, FaXTwitter } from "react-icons/fa6";

const socialLinks = [
  { label: "X", href: publicConfig.xUrl, icon: FaXTwitter },
  { label: "Instagram", href: publicConfig.instagramUrl, icon: FaInstagram },
  { label: "TikTok", href: publicConfig.tiktokUrl, icon: FaTiktok },
  { label: "LinkedIn", href: publicConfig.linkedinUrl, icon: FaLinkedinIn },
  { label: "Facebook", href: publicConfig.facebookUrl, icon: FaFacebookF },
];

export default function Footer() {
  const { t } = useTranslation();
  const footerColumns = [
    {
      heading: t('footer.about'),
      links: [
        { label: t('footer.aboutDeliivo'), href: "/" },
        { label: t('nav.howItWorks'), href: "/#how-it-works" },
        { label: t('nav.guides'), href: "/blog" },
      ],
    },
    {
      heading: t('footer.drivers'),
      links: [
        { label: t('footer.publishRide'), href: "/publish" },
        { label: t('footer.vehicle'), href: "/profile/vehicle" },
        { label: t('nav.earnings'), href: "/profile/earnings" },
      ],
    },
    {
      heading: t('footer.passengers'),
      links: [
        { label: t('nav.searchRide'), href: "/search" },
        { label: t('nav.yourRides'), href: "/rides" },
        { label: t('footer.profile'), href: "/profile" },
      ],
    },
    {
      heading: t('footer.support'),
      links: [
        { label: t('footer.faq'), href: "/faq" },
        { label: t('nav.support'), href: "/contact" },
        { label: t('footer.privacy'), href: "/privacy" },
        { label: t('footer.terms'), href: "/terms" },
      ],
    },
  ];

  return (
    <footer style={{ backgroundColor: "#1a1a2e" }} className="text-gray-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {/* Top section: logo + columns */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="mb-4 flex items-center">
              <span className="relative h-9 w-9 shrink-0 overflow-hidden" aria-hidden="true">
                <Image src="/logo.png" alt="" width={104} height={36} className="h-9 w-auto max-w-none object-contain object-left" />
              </span>
              <span className="ml-2 text-xl font-black tracking-tight text-white">Deliivo</span>
            </Link>
            <p className="text-sm leading-relaxed text-gray-500">
              {t('footer.description')}
            </p>
          </div>

          {/* Link columns */}
          {footerColumns.map((col) => (
            <div key={col.heading}>
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">
                {col.heading}
              </h3>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-gray-500 transition-colors hover:text-deliivo-orange"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-white/10 pt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-gray-600">
            &copy; {new Date().getFullYear()} Deliivo. {t('footer.rights')}
          </p>

          {/* Social links */}
          <div className="flex items-center gap-4">
            {socialLinks.map((social) => {
              const SocialIcon = social.icon;
              return (
              <a
                key={social.href}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-xs font-bold text-gray-500 transition-colors hover:border-deliivo-orange hover:text-deliivo-orange"
              >
                <SocialIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              );
            })}
          </div>
        </div>
      </div>
    </footer>
  );
}

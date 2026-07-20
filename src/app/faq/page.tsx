'use client';

import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { publicConfig } from '@/lib/public-config';
import { useTranslation } from '@/lib/i18n-context';
import { localeToUrlCode } from '@/lib/i18n';

const faqs = [
  { q: 'faq.q1', a: 'faq.a1' },
  { q: 'faq.q2', a: 'faq.a2' },
  { q: 'faq.q3', a: 'faq.a3' },
  { q: 'faq.q4', a: 'faq.a4' },
  { q: 'faq.q5', a: 'faq.a5' },
  { q: 'faq.q6', a: 'faq.a6' },
];

const quickStarts = [
  {
    title: 'faq.bookQuickStart',
    steps: ['faq.bookStep1', 'faq.bookStep2', 'faq.bookStep3', 'faq.bookStep4'],
  },
  {
    title: 'faq.publishQuickStart',
    steps: ['faq.publishStep1', 'faq.publishStep2', 'faq.publishStep3', 'faq.publishStep4'],
  },
];

export default function FaqPage() {
  const { t, locale } = useTranslation();
  const localePrefix = localeToUrlCode(locale);
  const homeUrl = `${publicConfig.siteUrl}/${localePrefix}`;
  const faqUrl = `${publicConfig.siteUrl}/${localePrefix}/faq`;
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${faqUrl}#faq`,
    url: faqUrl,
    name: t('faq.title'),
    inLanguage: locale,
    mainEntity: faqs.map((item) => ({
      '@type': 'Question',
      name: t(item.q),
      acceptedAnswer: {
        '@type': 'Answer',
        text: t(item.a, { email: publicConfig.supportEmail }),
      },
    })),
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${faqUrl}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t('common.home'), item: homeUrl },
      { '@type': 'ListItem', position: 2, name: t('faq.title'), item: faqUrl },
    ],
  };

  return (
    <div className="flex min-h-full flex-col bg-deliivo-cream">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <Navbar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase text-deliivo-orange">{t('faq.kicker')}</p>
          <h1 className="mt-2 text-3xl font-bold text-deliivo-dark">{t('faq.title')}</h1>
        </div>

        <section className="mb-10 grid gap-4 md:grid-cols-2" aria-labelledby="quick-start-title">
          <div className="md:col-span-2">
            <h2 id="quick-start-title" className="text-2xl font-bold text-deliivo-dark">{t('faq.quickStart')}</h2>
            <p className="mt-1 text-sm text-deliivo-gray">{t('faq.quickStartIntro')}</p>
          </div>
          {quickStarts.map((guide) => (
            <article key={guide.title} className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-deliivo-dark">{t(guide.title)}</h3>
              <ol className="mt-4 space-y-3">
                {guide.steps.map((step, index) => (
                  <li key={step} className="flex gap-3 text-sm leading-6 text-deliivo-gray">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-bold text-deliivo-orange">{index + 1}</span>
                    <span>{t(step)}</span>
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </section>

        <div className="space-y-4">
          {faqs.map((item) => (
            <section key={item.q} className="rounded-lg bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-deliivo-dark">{t(item.q)}</h2>
              <p className="mt-2 text-sm leading-6 text-deliivo-gray">
                {t(item.a, { email: publicConfig.supportEmail })}
              </p>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}

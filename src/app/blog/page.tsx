'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Lightbulb, Loader2, Mail, Search, ShieldCheck, Users } from 'lucide-react';
import { contentApi, ContentPost } from '@/lib/api';
import { useTranslation } from '@/lib/i18n-context';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { localeToUrlCode } from '@/lib/i18n';
import { publicConfig } from '@/lib/public-config';

type Translate = (key: string, params?: Record<string, string | number>) => string;
type Category = ContentPost['category'];

const categoryIcon: Record<string, typeof Users> = {
  'Rider guide': Users,
  'Driver guide': BookOpen,
  'Rider blog': Users,
  'Driver blog': BookOpen,
  Safety: ShieldCheck,
  'Product update': BookOpen,
};

const categoryLabelKeys: Record<Category, string> = {
  'Rider guide': 'blog.categoryRider',
  'Driver guide': 'blog.categoryDriver',
  Safety: 'blog.categorySafety',
  'Product update': 'blog.categoryProduct',
};

const categoryTagKeys: Record<Category, string[]> = {
  'Rider guide': ['blog.tag.booking', 'blog.tag.pickupPoints', 'blog.tag.travelTips'],
  'Driver guide': ['blog.tag.publishing', 'blog.tag.earnings', 'blog.tag.tripPrep'],
  Safety: ['blog.tag.safety', 'blog.tag.trust', 'blog.tag.support'],
  'Product update': ['blog.tag.product', 'blog.tag.release', 'blog.tag.admin'],
};

function getCategoryLabel(t: Translate, category: string) {
  return t(categoryLabelKeys[category as Category] || 'blog.categoryProduct');
}

function getCategoryTags(t: Translate, category: Category) {
  return categoryTagKeys[category].map((key) => t(key));
}

export default function BlogPage() {
  const { t, locale } = useTranslation();
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | ContentPost['category']>('All');
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    setLoading(true);
    contentApi.listPublished(locale).then((res) => {
      setPosts(res.data || []);
    }).catch(() => {
      setPosts([]);
    }).finally(() => setLoading(false));
  }, [locale]);

  const categories = useMemo(() => ['All', ...Array.from(new Set(posts.map((post) => post.category)))] as const, [posts]);
  const categoryCounts = useMemo(() => new Map(categories.map((category) => [category, category === 'All' ? posts.length : posts.filter((post) => post.category === category).length])), [categories, posts]);
  const filteredPosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return posts.filter((post) => {
      const matchesCategory = selectedCategory === 'All' || post.category === selectedCategory;
      const matchesSearch = !query
        || post.title.toLowerCase().includes(query)
        || post.excerpt.toLowerCase().includes(query)
        || post.body.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [posts, search, selectedCategory]);

  const [featuredPost, ...remainingPosts] = filteredPosts;
  const popularPosts = posts.slice(0, 3);

  async function handleNewsletterSubmit(event: React.FormEvent) {
    event.preventDefault();
    setNewsletterStatus('saving');
    try {
      await contentApi.subscribeNewsletter(newsletterEmail, locale);
      setNewsletterStatus('saved');
      setNewsletterEmail('');
    } catch {
      setNewsletterStatus('error');
    }
  }
  const localePrefix = localeToUrlCode(locale);
  const blogBasePath = `/${localePrefix}/blog`;
  const contactPath = `/${localePrefix}/contact?subject=blog-topic`;
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t('common.home'), item: `${publicConfig.siteUrl}/${localePrefix}` },
      { '@type': 'ListItem', position: 2, name: t('nav.guides'), item: `${publicConfig.siteUrl}/${localePrefix}/blog` },
    ],
  };

  return (
    <div className="min-h-screen bg-[#fbfaf8]">
      <Navbar />
      <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <section className="bg-white border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-deliivo-orange">
            {t('blog.kicker')}
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold tracking-tight text-deliivo-dark">
            {t('blog.title')}
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-deliivo-gray">
            {t('blog.copy')}
          </p>
          <div className="mt-8 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <label className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
              <Search className="h-4 w-4 text-deliivo-gray" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('blog.searchPlaceholder')}
                className="w-full bg-transparent text-sm text-deliivo-dark outline-none placeholder:text-deliivo-gray"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                    selectedCategory === category
                      ? 'bg-deliivo-orange text-white'
                      : 'border border-gray-200 bg-white text-deliivo-gray hover:border-deliivo-orange hover:text-deliivo-orange'
                  }`}
                >
                  {category === 'All' ? t('blog.allArticles') : getCategoryLabel(t, category)}
                  <span className="ml-1 opacity-70">{categoryCounts.get(category) || 0}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-deliivo-orange" />
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-deliivo-gray shadow-sm">
            {t('blog.noPostsYet')}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-base font-semibold text-deliivo-dark">{t('blog.noMatchesTitle')}</p>
            <p className="mt-2 text-sm text-deliivo-gray">{t('blog.noMatchesCopy')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {featuredPost && (
              <Link href={`${blogBasePath}/${featuredPost.slug}`} className="block overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="bg-[linear-gradient(135deg,#fff1e6_0%,#ffffff_60%,#f7fafc_100%)] px-6 py-8 sm:px-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-deliivo-orange">{t('blog.featuredPost')}</p>
                    <div className="mt-4 flex items-center gap-2 text-sm font-medium text-deliivo-gray">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-deliivo-orange shadow-sm">
                        {(() => {
                          const Icon = categoryIcon[featuredPost.category];
                          return <Icon size={18} />;
                        })()}
                      </span>
                      {getCategoryLabel(t, featuredPost.category)}
                    </div>
                    <h2 className="mt-5 max-w-2xl text-3xl font-bold tracking-tight text-deliivo-dark">{featuredPost.title}</h2>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-deliivo-gray">{featuredPost.excerpt}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {getCategoryTags(t, featuredPost.category).map((tag) => (
                        <span key={tag} className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-deliivo-gray shadow-sm">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                      <span>{new Date(featuredPost.publishedAt || featuredPost.updatedAt).toLocaleDateString()}</span>
                      <span>{featuredPost.readTime}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-deliivo-gray shadow-sm">{featuredPost.locale.toUpperCase()}</span>
                    </div>
                    <span className="mt-7 inline-flex items-center gap-2 rounded-full bg-deliivo-orange px-5 py-3 text-sm font-semibold text-white">
                      {t('blog.readFeatured')}
                      <ArrowRight size={16} />
                    </span>
                  </div>
                  <div className="min-h-72 overflow-hidden border-t border-gray-100 lg:border-l lg:border-t-0">
                    <img src={featuredPost.coverImageUrl || '/baltic-hero-v2.png'} alt="" className="h-full min-h-72 w-full object-cover" />
                  </div>
                </div>
              </Link>
            )}

            <div className="grid gap-5 lg:grid-cols-3">
            {remainingPosts.map((post) => {
              const Icon = categoryIcon[post.category];
              return (
                <Link key={post.id} href={`${blogBasePath}/${post.slug}`} className="block overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                  <img src={post.coverImageUrl || '/baltic-hero-v2.png'} alt="" className="h-44 w-full object-cover" />
                  <div className="p-6">
                  <div className="flex items-center gap-2 text-sm font-medium text-deliivo-gray">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 text-deliivo-orange">
                      <Icon size={16} />
                    </span>
                    {getCategoryLabel(t, post.category)}
                  </div>
                  <h2 className="mt-5 text-xl font-semibold text-deliivo-dark">{post.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-deliivo-gray">{post.excerpt}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {getCategoryTags(t, post.category).map((tag) => (
                      <span key={tag} className="rounded-full bg-orange-50 px-3 py-1 text-[11px] font-semibold text-deliivo-orange">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-sm text-deliivo-gray line-clamp-4">
                    {post.body}
                  </div>
                  <div className="mt-5 flex items-center justify-between text-xs text-gray-500">
                    <span>{new Date(post.publishedAt || post.updatedAt).toLocaleDateString()}</span>
                    <span>{post.readTime}</span>
                  </div>
                  <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-deliivo-orange">
                    {t('blog.openArticle')}
                    <ArrowRight size={15} />
                  </span>
                  </div>
                </Link>
              );
            })}
            </div>
          </div>
        )}
      </section>
      <section className="border-t border-gray-100 bg-white px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_1fr_0.8fr]">
          <div className="rounded-3xl border border-gray-200 bg-[#fbfaf8] p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-deliivo-dark"><BookOpen className="h-5 w-5 text-deliivo-orange" /> {t('blog.browseByCategory')}</h2>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {categories.filter((category) => category !== 'All').map((category) => (
                <button key={category} type="button" onClick={() => { setSelectedCategory(category); window.scrollTo({ top: 220, behavior: 'smooth' }); }} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-left text-sm font-semibold text-deliivo-dark shadow-sm">
                  {getCategoryLabel(t, category)} <span className="rounded-full bg-orange-50 px-2 py-1 text-xs text-deliivo-orange">{categoryCounts.get(category) || 0}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-[#fbfaf8] p-6">
            <h2 className="text-lg font-bold text-deliivo-dark">{t('blog.popularPosts')}</h2>
            <div className="mt-4 space-y-3">
              {popularPosts.map((post) => (
                <Link key={post.id} href={`${blogBasePath}/${post.slug}`} className="block rounded-2xl bg-white px-4 py-3 shadow-sm transition hover:shadow-md">
                  <p className="line-clamp-2 text-sm font-bold text-deliivo-dark">{post.title}</p>
                  <p className="mt-1 text-xs text-deliivo-gray">{post.readTime}</p>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-orange-100 bg-orange-50 p-6">
              <Lightbulb className="h-6 w-6 text-deliivo-orange" />
              <h2 className="mt-4 text-lg font-bold text-deliivo-dark">{t('blog.haveTopic')}</h2>
              <p className="mt-2 text-sm leading-6 text-deliivo-gray">{t('blog.topicCopy')}</p>
              <Link href={contactPath} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-deliivo-orange">{t('blog.suggestTopic')} <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </div>

        <form onSubmit={handleNewsletterSubmit} className="mx-auto mt-6 flex max-w-7xl flex-col gap-4 rounded-3xl bg-deliivo-dark p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><Mail className="mt-1 h-5 w-5 text-deliivo-orange" /><div><h2 className="font-bold">{t('blog.newsletterTitle')}</h2><p className="mt-1 text-sm text-white/65">{t('blog.newsletterCopy')}</p></div></div>
          <div className="flex w-full max-w-xl flex-col gap-2 sm:flex-row">
            <input type="email" required value={newsletterEmail} onChange={(event) => { setNewsletterEmail(event.target.value); setNewsletterStatus('idle'); }} placeholder={t('blog.newsletterPlaceholder')} className="min-w-0 flex-1 rounded-full border border-white/15 bg-white px-4 py-3 text-sm text-deliivo-dark outline-none" />
            <button type="submit" disabled={newsletterStatus === 'saving'} className="rounded-full bg-deliivo-orange px-6 py-3 text-sm font-bold text-white disabled:opacity-60">{newsletterStatus === 'saving' ? t('blog.newsletterSaving') : t('blog.newsletterSubscribe')}</button>
          </div>
          {newsletterStatus === 'saved' && <p className="text-sm font-semibold text-green-300">{t('blog.newsletterSuccess')}</p>}
          {newsletterStatus === 'error' && <p className="text-sm font-semibold text-red-300">{t('blog.newsletterError')}</p>}
        </form>
      </section>
      </main>
      <Footer />
    </div>
  );
}

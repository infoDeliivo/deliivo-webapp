'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, Loader2, Search, ShieldCheck, Users } from 'lucide-react';
import { contentApi, ContentPost } from '@/lib/api';
import { useTranslation } from '@/lib/i18n-context';

const categoryIcon: Record<string, typeof Users> = {
  'Rider guide': Users,
  'Driver guide': BookOpen,
  'Rider blog': Users,
  'Driver blog': BookOpen,
  Safety: ShieldCheck,
  'Product update': BookOpen,
};

const categoryLabel = (category: string) => {
  if (category === 'Rider guide') return 'Rider blog';
  if (category === 'Driver guide') return 'Driver blog';
  if (category === 'Rider blog') return 'Rider blog';
  if (category === 'Driver blog') return 'Driver blog';
  return category;
};

const categoryTags: Record<ContentPost['category'], string[]> = {
  'Rider guide': ['Booking', 'Pickup points', 'Travel tips'],
  'Driver guide': ['Publishing', 'Earnings', 'Trip prep'],
  Safety: ['Safety', 'Trust', 'Support'],
  'Product update': ['Product', 'Release', 'Admin'],
};

export default function BlogPage() {
  const { t, locale } = useTranslation();
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | ContentPost['category']>('All');

  useEffect(() => {
    setLoading(true);
    contentApi.listPublished(locale).then((res) => {
      setPosts(res.data || []);
    }).catch(() => {
      setPosts([]);
    }).finally(() => setLoading(false));
  }, [locale]);

  const categories = useMemo(() => ['All', ...Array.from(new Set(posts.map((post) => post.category)))] as const, [posts]);
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
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://deliivo.com/' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://deliivo.com/blog' },
    ],
  };

  return (
    <main className="min-h-screen bg-gray-50">
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
                placeholder="Search articles, safety topics, routes, or product updates"
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
                  {category === 'All' ? 'All articles' : categoryLabel(category)}
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
            No published blog posts yet.
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-base font-semibold text-deliivo-dark">No blog posts matched these filters.</p>
            <p className="mt-2 text-sm text-deliivo-gray">Try a different keyword or clear the category filter.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {featuredPost && (
              <Link href={`/blog/${featuredPost.slug}`} className="block overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
                <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="bg-[linear-gradient(135deg,#fff1e6_0%,#ffffff_60%,#f7fafc_100%)] px-6 py-8 sm:px-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-deliivo-orange">Featured post</p>
                    <div className="mt-4 flex items-center gap-2 text-sm font-medium text-deliivo-gray">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-deliivo-orange shadow-sm">
                        {(() => {
                          const Icon = categoryIcon[featuredPost.category];
                          return <Icon size={18} />;
                        })()}
                      </span>
                      {categoryLabel(featuredPost.category)}
                    </div>
                    <h2 className="mt-5 max-w-2xl text-3xl font-bold tracking-tight text-deliivo-dark">{featuredPost.title}</h2>
                    <p className="mt-4 max-w-2xl text-base leading-7 text-deliivo-gray">{featuredPost.excerpt}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {categoryTags[featuredPost.category].map((tag) => (
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
                      Read featured article
                      <ArrowRight size={16} />
                    </span>
                  </div>
                  <div className="border-t border-gray-100 px-6 py-8 lg:border-l lg:border-t-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-deliivo-gray">Why this matters</p>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl bg-gray-50 px-4 py-3">
                        <p className="text-sm font-semibold text-deliivo-dark">Operational content</p>
                        <p className="mt-1 text-xs leading-5 text-deliivo-gray">These posts support booking decisions, ride-day expectations, safety, and support follow-up.</p>
                      </div>
                      <div className="rounded-2xl bg-gray-50 px-4 py-3">
                        <p className="text-sm font-semibold text-deliivo-dark">Category signal</p>
                        <p className="mt-1 text-xs leading-5 text-deliivo-gray">Use rider, driver, safety, and product categories to find the right article faster.</p>
                      </div>
                      <div className="rounded-2xl bg-gray-50 px-4 py-3">
                        <p className="text-sm font-semibold text-deliivo-dark">Discovery count</p>
                        <p className="mt-1 text-xs leading-5 text-deliivo-gray">{filteredPosts.length} published article{filteredPosts.length === 1 ? '' : 's'} currently match your filters.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            )}

            <div className="grid gap-5 lg:grid-cols-3">
            {remainingPosts.map((post) => {
              const Icon = categoryIcon[post.category];
              return (
                <Link key={post.id} href={`/blog/${post.slug}`} className="block rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex items-center gap-2 text-sm font-medium text-deliivo-gray">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 text-deliivo-orange">
                      <Icon size={16} />
                    </span>
                    {categoryLabel(post.category)}
                  </div>
                  <h2 className="mt-5 text-xl font-semibold text-deliivo-dark">{post.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-deliivo-gray">{post.excerpt}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {categoryTags[post.category].map((tag) => (
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
                    Open article
                    <ArrowRight size={15} />
                  </span>
                </Link>
              );
            })}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BookOpen, Loader2, ShieldCheck, Users } from 'lucide-react';
import { contentApi, ContentPost } from '@/lib/api';
import { useTranslation } from '@/lib/i18n-context';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

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

export default function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { locale } = useTranslation();
  const [post, setPost] = useState<ContentPost | null>(null);
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError('');
    Promise.all([
      contentApi.getPublishedBySlug(slug, locale),
      contentApi.listPublished(locale),
    ])
      .then(([postRes, listRes]) => {
        setPost(postRes.data);
        setPosts(listRes.data || []);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load article'))
      .finally(() => setLoading(false));
  }, [slug, locale]);

  const relatedPosts = useMemo(
    () => posts.filter((candidate) => candidate.slug !== post?.slug && candidate.category === post?.category).slice(0, 3),
    [posts, post?.slug, post?.category],
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-deliivo-orange" />
        </div>
      </main>
    );
  }

  if (!post) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-semibold text-deliivo-orange hover:text-orange-700">
            <ArrowLeft size={16} />
            Back to blog
          </Link>
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-semibold text-deliivo-dark">Article unavailable</p>
            <p className="mt-2 text-sm text-deliivo-gray">{error || 'This blog post could not be found.'}</p>
          </div>
        </div>
      </main>
    );
  }

  const Icon = categoryIcon[post.category];
  const rawAuthor = post.updatedBy || post.createdBy || '';
  const authorLabel = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(rawAuthor) ? 'Deliivo Blog Editorial' : (rawAuthor || 'Deliivo Blog Editorial');
  const articleUrl = `https://deliivo.com/blog/${post.slug}`;
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    articleSection: categoryLabel(post.category),
    datePublished: post.publishedAt || post.updatedAt,
    dateModified: post.updatedAt,
    inLanguage: post.locale,
    author: {
      '@type': 'Organization',
      name: authorLabel,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Deliivo',
      logo: {
        '@type': 'ImageObject',
        url: 'https://deliivo.com/logo.png',
      },
    },
    mainEntityOfPage: articleUrl,
    url: articleUrl,
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://deliivo.com/' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://deliivo.com/blog' },
      { '@type': 'ListItem', position: 3, name: post.title, item: articleUrl },
    ],
  };

  return (
    <div className="min-h-screen bg-gray-50">
    <Navbar />
    <main>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <section className="border-b border-gray-100 bg-white">
        <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm font-semibold text-deliivo-orange hover:text-orange-700">
            <ArrowLeft size={16} />
            Back to blog
          </Link>
          <div className="mt-8 flex items-center gap-2 text-sm font-medium text-deliivo-gray">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 text-deliivo-orange">
              <Icon size={16} />
            </span>
            {categoryLabel(post.category)}
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-deliivo-dark">{post.title}</h1>
          <p className="mt-4 text-lg text-deliivo-gray">{post.excerpt}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {categoryTags[post.category].map((tag) => (
              <span key={tag} className="rounded-full bg-orange-50 px-3 py-1 text-[11px] font-semibold text-deliivo-orange">
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-4 text-sm text-gray-500">
            <span>{new Date(post.publishedAt || post.updatedAt).toLocaleDateString()}</span>
            <span>{post.readTime}</span>
          </div>
          <img src={post.coverImageUrl || '/baltic-hero-v2.png'} alt="" className="mt-8 h-64 w-full rounded-3xl object-cover sm:h-96" />
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <article className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="mb-6 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-deliivo-gray">Author</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-bold text-deliivo-orange shadow-sm">
                {authorLabel.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-deliivo-dark">{authorLabel}</p>
                <p className="text-xs text-deliivo-gray">Deliivo blog editorial</p>
              </div>
            </div>
          </div>
          <div className="prose prose-gray max-w-none whitespace-pre-line text-deliivo-gray">
            {post.body}
          </div>
        </article>

        {relatedPosts.length > 0 && (
          <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-deliivo-dark">Related articles</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {relatedPosts.map((relatedPost) => (
                <Link
                  key={relatedPost.id}
                  href={`/blog/${relatedPost.slug}`}
                  className="rounded-2xl border border-gray-100 bg-gray-50 p-4 transition-colors hover:border-deliivo-orange hover:bg-orange-50/40"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-deliivo-orange">{categoryLabel(relatedPost.category)}</p>
                  <p className="mt-2 text-sm font-semibold text-deliivo-dark">{relatedPost.title}</p>
                  <p className="mt-2 text-xs leading-5 text-deliivo-gray">{relatedPost.excerpt}</p>
                </Link>
              ))}
            </div>
          </section>
        )}
      </section>
    </main>
    <Footer />
    </div>
  );
}

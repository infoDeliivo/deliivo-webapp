'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BookOpen, Loader2, ShieldCheck, Users } from 'lucide-react';
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

function renderInlineMarkup(text: string) {
  const tokens = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g);
  return tokens.map((token, index) => {
    const bold = token.match(/^\*\*(.+)\*\*$/);
    if (bold) return <strong key={index} className="font-semibold text-deliivo-dark">{bold[1]}</strong>;
    const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer" className="font-medium text-deliivo-orange underline underline-offset-2">{link[1]}</a>;
    return token;
  });
}

function ArticleBody({ body }: { body: string }) {
  return (
    <div className="space-y-5 text-base leading-8 text-deliivo-gray">
      {body.split(/\n{2,}/).filter(Boolean).map((block, index) => {
        const lines = block.split('\n');
        if (lines[0].startsWith('## ')) {
          return <h2 key={index} className="pt-2 text-2xl font-bold text-deliivo-dark">{renderInlineMarkup(lines[0].slice(3))}</h2>;
        }
        if (lines.every((line) => /^-\s+/.test(line))) {
          return <ul key={index} className="list-disc space-y-2 pl-6">{lines.map((line, lineIndex) => <li key={lineIndex}>{renderInlineMarkup(line.replace(/^-\s+/, ''))}</li>)}</ul>;
        }
        return <p key={index}>{lines.map((line, lineIndex) => <span key={lineIndex}>{renderInlineMarkup(line)}{lineIndex < lines.length - 1 && <br />}</span>)}</p>;
      })}
    </div>
  );
}

export default function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { locale, t } = useTranslation();
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
          <Link href={`/${localeToUrlCode(locale)}/blog`} className="inline-flex items-center gap-2 text-sm font-semibold text-deliivo-orange hover:text-orange-700">
            <ArrowLeft size={16} />
            {t('blog.backToBlog')}
          </Link>
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-semibold text-deliivo-dark">{t('blog.articleUnavailable')}</p>
            <p className="mt-2 text-sm text-deliivo-gray">{error || t('blog.articleNotFound')}</p>
          </div>
        </div>
      </main>
    );
  }

  const Icon = categoryIcon[post.category];
  const rawAuthor = post.updatedBy || post.createdBy || '';
  const authorLabel = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(rawAuthor) ? t('blog.editorial') : (rawAuthor || t('blog.editorial'));
  const localePrefix = localeToUrlCode(locale);
  const blogBasePath = `/${localePrefix}/blog`;
  const articleUrl = `${publicConfig.siteUrl}/${localePrefix}/blog/${post.slug}`;
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    articleSection: getCategoryLabel(t, post.category),
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
        url: `${publicConfig.siteUrl}/logo.png`,
      },
    },
    mainEntityOfPage: articleUrl,
    url: articleUrl,
    image: post.coverImageUrl || `${publicConfig.siteUrl}/baltic-hero-v2.png`,
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: t('common.home'), item: `${publicConfig.siteUrl}/${localePrefix}` },
      { '@type': 'ListItem', position: 2, name: t('nav.guides'), item: `${publicConfig.siteUrl}/${localePrefix}/blog` },
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
          <Link href={blogBasePath} className="inline-flex items-center gap-2 text-sm font-semibold text-deliivo-orange hover:text-orange-700">
            <ArrowLeft size={16} />
            {t('blog.backToBlog')}
          </Link>
          <div className="mt-8 flex items-center gap-2 text-sm font-medium text-deliivo-gray">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 text-deliivo-orange">
              <Icon size={16} />
            </span>
            {getCategoryLabel(t, post.category)}
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-deliivo-dark">{post.title}</h1>
          <p className="mt-4 text-lg text-deliivo-gray">{post.excerpt}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {getCategoryTags(t, post.category).map((tag) => (
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
            <p className="text-xs font-semibold uppercase tracking-wide text-deliivo-gray">{t('blog.author')}</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-sm font-bold text-deliivo-orange shadow-sm">
                {authorLabel.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-deliivo-dark">{authorLabel}</p>
                <p className="text-xs text-deliivo-gray">{t('blog.editorial')}</p>
              </div>
            </div>
          </div>
          <ArticleBody body={post.body} />
        </article>

        {relatedPosts.length > 0 && (
          <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-deliivo-dark">{t('blog.relatedArticles')}</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {relatedPosts.map((relatedPost) => (
                <Link
                  key={relatedPost.id}
                  href={`${blogBasePath}/${relatedPost.slug}`}
                  className="rounded-2xl border border-gray-100 bg-gray-50 p-4 transition-colors hover:border-deliivo-orange hover:bg-orange-50/40"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-deliivo-orange">{getCategoryLabel(t, relatedPost.category)}</p>
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

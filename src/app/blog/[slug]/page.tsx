'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BookOpen, Loader2, ShieldCheck, Users } from 'lucide-react';
import { contentApi, ContentPost } from '@/lib/api';
import { useTranslation } from '@/lib/i18n-context';

const categoryIcon = {
  'Rider guide': Users,
  'Driver guide': BookOpen,
  Safety: ShieldCheck,
  'Product update': BookOpen,
};

export default function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { locale } = useTranslation();
  const [post, setPost] = useState<ContentPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError('');
    contentApi.getPublishedBySlug(slug, locale)
      .then((res) => setPost(res.data))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load article'))
      .finally(() => setLoading(false));
  }, [slug, locale]);

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

  return (
    <main className="min-h-screen bg-gray-50">
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
            {post.category}
          </div>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-deliivo-dark">{post.title}</h1>
          <p className="mt-4 text-lg text-deliivo-gray">{post.excerpt}</p>
          <div className="mt-5 flex items-center gap-4 text-sm text-gray-500">
            <span>{new Date(post.publishedAt || post.updatedAt).toLocaleDateString()}</span>
            <span>{post.readTime}</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <article className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="prose prose-gray max-w-none whitespace-pre-line text-deliivo-gray">
            {post.body}
          </div>
        </article>
      </section>
    </main>
  );
}

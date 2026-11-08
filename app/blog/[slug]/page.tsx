import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarketingCta } from "@/components/marketing/MarketingCta";
import { DEFAULT_APP_ORIGIN } from "@/lib/brand";
import { SitePage } from "@/components/marketing/SitePage";
import { getBlogPost, listBlogPosts } from "@/lib/marketing/blog";
import { pageMetadata } from "@/lib/marketing/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return listBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = getBlogPost((await params).slug);
  if (!post) return {};
  return pageMetadata({
    path: `/blog/${post.slug}`,
    title: `${post.title} | SequenceFlow`,
    shareTitle: post.title,
    description: post.description,
    type: "article",
  });
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = getBlogPost((await params).slug);
  if (!post) notFound();
  return (
    <SitePage narrow>
      <article className="mk-article">
        <Link href="/blog" className="mk-text-link">← Alle artikelen</Link>
        <header>
          {post.tag ? <span className="mk-blog-tag">{post.tag}</span> : null}
          <h1>{post.title}</h1>
          <p className="mk-article-meta">{[post.author, post.publishDate, post.readTime].filter(Boolean).join(" · ")}</p>
        </header>
        {/* De omslagfiguur staat ook in de tekst zelf; alleen tonen als die er niet al in staat. */}
        {post.coverHtml && !post.html.includes(post.coverHtml) ? <div className="mk-article-cover" dangerouslySetInnerHTML={{ __html: post.coverHtml }} /> : null}
        <div className="mk-prose" dangerouslySetInnerHTML={{ __html: post.html }} />
        <aside className="mk-article-cta">
          <h2>Probeer het in je eigen inbox.</h2>
          <p>Seffy zet bij elke klantmail een antwoord klaar met je eigen beleid en de bestelling erbij. Otis houdt je voorraad in de gaten. Jij beslist.</p>
          <MarketingCta href={`${DEFAULT_APP_ORIGIN}/login?intent=signup&source=blog`}>Start 14 dagen gratis</MarketingCta>
        </aside>
      </article>
    </SitePage>
  );
}

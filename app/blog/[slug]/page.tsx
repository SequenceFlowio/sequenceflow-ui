import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BlogCover } from "@/components/marketing/BlogCover";
import { MarketingCta } from "@/components/marketing/MarketingCta";
import { SitePage } from "@/components/marketing/SitePage";
import { getBlogPost, listBlogPosts } from "@/lib/marketing/blog";
import { SITE_ORIGIN } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return listBlogPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const post = getBlogPost((await params).slug);
  if (!post) return {};
  const url = `${SITE_ORIGIN}/blog/${post.slug}`;
  return {
    title: `${post.title} | SequenceFlow`,
    description: post.description,
    alternates: { canonical: url },
    openGraph: { title: post.title, description: post.description, url, type: "article" },
  };
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
        <BlogCover index={listBlogPosts().findIndex((item) => item.slug === post.slug)} large />
        <div className="mk-prose" dangerouslySetInnerHTML={{ __html: post.html }} />
        <aside className="mk-article-cta">
          <h2>Probeer het in je eigen inbox.</h2>
          <p>Support One schrijft een concept voor elke klantvraag, op basis van je eigen beleid. Jij beslist wat er verstuurd wordt.</p>
          <MarketingCta href="/login?intent=signup&source=blog">Start gratis</MarketingCta>
        </aside>
      </article>
    </SitePage>
  );
}

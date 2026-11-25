import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MarketingCta } from "@/components/marketing/MarketingCta";
import { DEFAULT_APP_ORIGIN } from "@/lib/brand";
import { MarketingAttribution } from "@/components/marketing/MarketingAttribution";
import { SitePage } from "@/components/marketing/SitePage";
import { getBlogPost, listBlogPosts, relatedBlogPosts } from "@/lib/marketing/blog";
import { SITE_ORIGIN } from "@/lib/site";
import { pageMetadata } from "@/lib/marketing/seo";

// Geplande posts staan al in content/blog maar worden pas na hun datum
// gebouwd; tot die tijd geeft de pagina een 404. Elk uur opnieuw kijken.
export const dynamicParams = true;
export const revalidate = 3600;

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
  const related = relatedBlogPosts(post.slug, post.tag);
  const published = post.publishAt ? new Date(post.publishAt).toISOString() : undefined;
  const modified = post.updatedAt > post.publishAt ? new Date(post.updatedAt).toISOString() : published;
  const url = `${SITE_ORIGIN}/blog/${post.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: post.title,
        description: post.description,
        abstract: post.summary || undefined,
        inLanguage: "nl-NL",
        datePublished: published,
        dateModified: modified,
        author: { "@type": "Organization", name: post.author, url: SITE_ORIGIN },
        publisher: { "@type": "Organization", name: "SequenceFlow", url: SITE_ORIGIN, logo: { "@type": "ImageObject", url: `${SITE_ORIGIN}/logo.png` } },
        mainEntityOfPage: url,
        keywords: post.keyword || undefined,
        articleSection: post.tag || undefined,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "SequenceFlow", item: SITE_ORIGIN },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_ORIGIN}/blog` },
          { "@type": "ListItem", position: 3, name: post.title, item: url },
        ],
      },
      ...(post.faq.length ? [{
        "@type": "FAQPage",
        mainEntity: post.faq.map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })),
      }] : []),
    ],
  };
  return (
    <SitePage narrow>
      <MarketingAttribution page={`/blog/${post.slug}`} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <article className="mk-article">
        <Link href="/blog" className="mk-text-link">← Alle artikelen</Link>
        <header>
          {post.tag ? <span className="mk-blog-tag">{post.tag}</span> : null}
          <h1>{post.title}</h1>
          <p className="mk-article-meta">{[post.author, post.publishDate, post.updatedAt > post.publishAt ? `bijgewerkt ${post.updated}` : "", post.readTime].filter(Boolean).join(" · ")}</p>
        </header>
        {post.summary ? (
          <aside className="mk-article-answer" aria-label="Kort antwoord">
            <strong>Kort antwoord</strong>
            <p>{post.summary}</p>
          </aside>
        ) : null}
        {/* De omslagfiguur staat ook in de tekst zelf; alleen tonen als die er niet al in staat. */}
        {post.coverHtml && !post.html.includes(post.coverHtml) ? <div className="mk-article-cover" dangerouslySetInnerHTML={{ __html: post.coverHtml }} /> : null}
        <div className="mk-prose" dangerouslySetInnerHTML={{ __html: post.html }} />
        <aside className="mk-article-cta">
          <h2>Probeer het in je eigen inbox.</h2>
          <p>Seffy zet bij elke klantmail een antwoord klaar met je eigen beleid en de bestelling erbij. Otis houdt je voorraad in de gaten. Jij beslist.</p>
          <MarketingCta href={`${DEFAULT_APP_ORIGIN}/login?intent=signup&source=blog`}>Start 14 dagen gratis</MarketingCta>
        </aside>
        {related.length ? (
          <nav className="mk-article-related" aria-label="Meer lezen">
            <h2>Lees ook</h2>
            <ul>
              {related.map((item) => (
                <li key={item.slug}><Link href={`/blog/${item.slug}`}>{item.tag ? <span>{item.tag}</span> : null}{item.title}</Link></li>
              ))}
            </ul>
          </nav>
        ) : null}
      </article>
    </SitePage>
  );
}

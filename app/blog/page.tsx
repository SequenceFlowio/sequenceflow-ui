import type { Metadata } from "next";
import Link from "next/link";

import { SitePage } from "@/components/marketing/SitePage";
import { listBlogPosts } from "@/lib/marketing/blog";
import { figureHtml } from "@/lib/marketing/blogFigures";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/blog",
  title: "Blog | SequenceFlow",
  shareTitle: "De SequenceFlow-blog",
  description: "Praktische artikelen voor webshops: klantenservice, retouren, voorraad en de drukke weken van het jaar.",
});

export default function BlogIndexPage() {
  const posts = listBlogPosts();
  return (
    <SitePage>
      <header className="mk-site-intro">
        <div className="mk-eyebrow"><span />KENNISBANK</div>
        <h1>Praktische kennis voor je webshop.</h1>
        <p>Over klantenservice, retouren, voorraad en de drukke weken van het jaar. Zonder jargon, met voorbeelden die je meteen kunt gebruiken.</p>
      </header>
      <ul className="mk-blog-grid">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`} className="mk-blog-card">
              {/* Eigen SVG uit blogFigures.ts, geen gebruikersinvoer. */}
              {post.cover ? <div className="mk-blog-cover" aria-hidden dangerouslySetInnerHTML={{ __html: figureHtml(post.cover) }} /> : null}
              <div>
                {post.tag ? <span className="so-state">{post.tag}</span> : null}
                <h2>{post.title}</h2>
                <p>{post.description}</p>
                <small>{[post.publishDate, post.readTime].filter(Boolean).join(" · ")}</small>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </SitePage>
  );
}

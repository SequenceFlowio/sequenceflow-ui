import type { Metadata } from "next";
import Link from "next/link";

import { SitePage } from "@/components/marketing/SitePage";
import { listBlogPosts } from "@/lib/marketing/blog";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/blog",
  title: "Blog | SequenceFlow",
  shareTitle: "De SequenceFlow-blog",
  description: "Artikelen over AI-klantenservice, social content en slimmer werken in e-commerce.",
});

export default function BlogIndexPage() {
  const posts = listBlogPosts();
  return (
    <SitePage>
      <header className="mk-site-intro">
        <div className="mk-eyebrow"><span />BLOG</div>
        <h1>Over klantenservice en automatisering.</h1>
        <p>Praktische stukken over AI in je supportinbox en wat het je team oplevert.</p>
      </header>
      <ul className="mk-blog-grid">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`} className="mk-blog-card">
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

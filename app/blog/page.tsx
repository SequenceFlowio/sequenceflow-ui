import type { Metadata } from "next";
import Link from "next/link";

import { BlogCover } from "@/components/marketing/BlogCover";
import { SitePage } from "@/components/marketing/SitePage";
import { listBlogPosts } from "@/lib/marketing/blog";
import { SITE_ORIGIN } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog | SequenceFlow",
  description: "Artikelen over AI-klantenservice, automatisering en slimmer werken in e-commerce.",
  alternates: { canonical: `${SITE_ORIGIN}/blog` },
};

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
        {posts.map((post, index) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`} className="mk-blog-card">
              <BlogCover index={index} tag={post.tag} />
              <div>
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

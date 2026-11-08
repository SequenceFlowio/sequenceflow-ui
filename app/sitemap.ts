import type { MetadataRoute } from "next";
import { listBlogPosts } from "@/lib/marketing/blog";
import { LEGAL_PAGES, SITE_ORIGIN } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // / stuurt door naar /support-one, dus die staat er niet in.
    "/support-one",
    "/pricing",
    "/support-one/en",
    "/en/pricing",
    "/affiliate",
    "/blog",
    ...listBlogPosts().map(post => `/blog/${post.slug}`),
    "/contact",
    "/privacy",
    "/terms",
    ...LEGAL_PAGES.map(page => page.path),
  ].map(path => ({ url: `${SITE_ORIGIN}${path}` }));
}

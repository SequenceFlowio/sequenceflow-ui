import type { MetadataRoute } from "next";
import { listBlogPosts } from "@/lib/marketing/blog";
import { LANDING_PAGES } from "@/lib/marketing/landingPages";
import { LEGAL_PAGES, SITE_ORIGIN } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "/pricing",
    ...Object.keys(LANDING_PAGES).filter(key => key !== "general").map(key => `/for/${key}`),
    "/blog",
    ...listBlogPosts().map(post => `/blog/${post.slug}`),
    "/contact",
    "/privacy",
    "/terms",
    ...LEGAL_PAGES.map(page => page.path),
  ].map(path => ({ url: `${SITE_ORIGIN}${path}` }));
}

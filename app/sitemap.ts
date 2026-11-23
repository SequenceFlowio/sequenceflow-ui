import type { MetadataRoute } from "next";
import { listBlogPosts } from "@/lib/marketing/blog";
import { LEGAL_PAGES, SITE_ORIGIN } from "@/lib/site";

/** Elk uur opnieuw, zodat geplande blogposts erin komen zodra ze live staan. */
export const revalidate = 3600;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // / stuurt door naar /nl, dus die staat er niet in.
    "/nl",
    "/nl/pricing",
    "/en",
    "/en/pricing",
    "/nl/affiliate",
    "/en/affiliate",
    "/blog",
    ...listBlogPosts().map(post => `/blog/${post.slug}`),
    "/nl/contact",
    "/nl/academy",
    "/en/academy",
    "/en/contact",
    "/privacy",
    "/terms",
    ...LEGAL_PAGES.flatMap(page => [page.path, page.en.path]),
  ].map(path => ({ url: `${SITE_ORIGIN}${path}` }));
}

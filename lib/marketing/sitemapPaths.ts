import { listBlogPosts } from "@/lib/marketing/blog";
import { LEGAL_PAGES } from "@/lib/site";

/** Alle openbare pagina's voor /sitemap.xml, met de blogposts die nu live staan. */
export function sitemapPaths(now = Date.now()): string[] {
  return [
    // / stuurt door naar /nl, dus die staat er niet in.
    "/nl",
    "/nl/pricing",
    "/en",
    "/en/pricing",
    "/nl/affiliate",
    "/en/affiliate",
    "/blog",
    ...listBlogPosts(now).map(post => `/blog/${post.slug}`),
    "/nl/contact",
    "/nl/academy",
    "/en/academy",
    "/en/contact",
    "/privacy",
    "/terms",
    ...LEGAL_PAGES.flatMap(page => [page.path, page.en.path]),
  ];
}

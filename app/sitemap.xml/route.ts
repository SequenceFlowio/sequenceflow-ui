import { sitemapPaths } from "@/lib/marketing/sitemapPaths";
import { SITE_ORIGIN } from "@/lib/site";

/**
 * /sitemap.xml als gewone route in plaats van app/sitemap.ts. De metadata-route
 * werd op Vercel alleen bij een deploy opnieuw gebouwd, waardoor geplande
 * blogposts er pas na de volgende deploy in kwamen. Deze route ververst elk uur,
 * net als /llms.txt, dus een geplande post staat er uiterlijk een uur na 07:00 in.
 */
export const revalidate = 3600;

const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function GET() {
  const urls = sitemapPaths().map((path) => `  <url>\n    <loc>${escape(`${SITE_ORIGIN}${path}`)}</loc>\n  </url>`).join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}

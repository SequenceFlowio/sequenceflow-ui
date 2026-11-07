import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";

// Alles wat achter een login zit.
const PRIVATE = ["/api/", "/auth/", "/login", "/inbox", "/dashboard", "/settings", "/knowledge", "/analytics", "/pijnpunten", "/intern", "/whats-new", "/sefi", "/lumen", "/integrations", "/commerce", "/inventory", "/agent-profile", "/upgrade", "/shopify", "/link-shopify"];

// AI-zoekmachines en assistenten mogen de website lezen, zodat ze het
// actuele verhaal vertellen in plaats van dat van de oude site. Samenvatting
// voor hen: /llms.txt.
const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_CRAWLERS, allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}

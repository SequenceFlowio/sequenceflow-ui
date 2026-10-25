import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";

// Alles wat achter een login zit, plus /home: dat is de interne route van de
// bedrijfspagina, die op sequenceflow.io gewoon op / staat.
const PRIVATE = ["/api/", "/auth/", "/login", "/inbox", "/dashboard", "/settings", "/knowledge", "/analytics", "/sefi", "/lumen", "/integrations", "/commerce", "/agent-profile", "/upgrade", "/shopify", "/link-shopify", "/home"];

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

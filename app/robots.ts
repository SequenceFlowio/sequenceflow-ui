import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/", "/login", "/inbox", "/dashboard", "/settings", "/knowledge", "/analytics", "/sefi", "/lumen", "/integrations", "/commerce", "/agent-profile", "/upgrade"] },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  };
}

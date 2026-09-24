import type { MetadataRoute } from "next";
import { DEFAULT_APP_ORIGIN } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/", "/login", "/inbox", "/dashboard", "/settings", "/knowledge", "/analytics", "/sefi", "/lumen", "/integrations", "/commerce", "/agent-profile", "/upgrade"] },
    sitemap: `${DEFAULT_APP_ORIGIN}/sitemap.xml`,
  };
}

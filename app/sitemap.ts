import type { MetadataRoute } from "next";
import { DEFAULT_APP_ORIGIN } from "@/lib/brand";
import { LANDING_PAGES } from "@/lib/marketing/landingPages";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/pricing", ...Object.keys(LANDING_PAGES).filter(key => key !== "general").map(key => `/for/${key}`)].map(path => ({ url: `${DEFAULT_APP_ORIGIN}${path}` }));
}

import { DEFAULT_APP_ORIGIN } from "@/lib/brand";

/**
 * The public website. sequenceflow.io serves the marketing pages of this app;
 * the app itself (login, inbox, settings, Shopify) stays on DEFAULT_APP_ORIGIN.
 */
export const SITE_ORIGIN = "https://www.sequenceflow.io";
const SITE_HOSTS = new Set(["sequenceflow.io", "www.sequenceflow.io"]);

export function isSiteHost(hostname: string | null | undefined) {
  return SITE_HOSTS.has((hostname ?? "").toLowerCase());
}

/** Pages that only exist in the app; on the website they redirect to the app domain. */
export const APP_ONLY_PATHS = [
  "/login", "/auth", "/oauth", "/shopify", "/link-shopify", "/upgrade",
  "/inbox", "/sefi", "/lumen", "/analytics", "/knowledge", "/integrations", "/commerce", "/inventory", "/settings", "/agent-profile", "/dashboard",
];

export function appUrl(path: string) {
  return `${DEFAULT_APP_ORIGIN}${path}`;
}

/** Company documents carried over from the old website, at their old addresses. */
export const LEGAL_PAGES = [
  { path: "/privacyverklaring", label: "Privacyverklaring" },
  { path: "/algemene-voorwaarden", label: "Algemene voorwaarden" },
  { path: "/verwerkersovereenkomst", label: "Verwerkersovereenkomst" },
  { path: "/service-level-agreement", label: "Service level agreement" },
  { path: "/acceptable-use-policy", label: "Acceptable use policy" },
  { path: "/ai-data-ethiek", label: "AI- en data-ethiek" },
] as const;

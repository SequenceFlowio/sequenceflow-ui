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
  "/inbox", "/sefi", "/lumen", "/analytics", "/pijnpunten", "/intern", "/whats-new", "/knowledge", "/integrations", "/commerce", "/inventory", "/settings", "/agent-profile", "/dashboard",
];

export function appUrl(path: string) {
  return `${DEFAULT_APP_ORIGIN}${path}`;
}

/**
 * Company documents, in Dutch under /nl and in English under /en. `legacy` is
 * the old address without a language; it redirects to the Dutch version.
 */
export const LEGAL_PAGES = [
  { path: "/nl/privacyverklaring", label: "Privacyverklaring", legacy: "/privacyverklaring", en: { path: "/en/privacy-statement", label: "Privacy statement" } },
  { path: "/nl/algemene-voorwaarden", label: "Algemene voorwaarden", legacy: "/algemene-voorwaarden", en: { path: "/en/terms-and-conditions", label: "Terms and conditions" } },
  { path: "/nl/verwerkersovereenkomst", label: "Verwerkersovereenkomst", legacy: "/verwerkersovereenkomst", en: { path: "/en/data-processing-agreement", label: "Data processing agreement" } },
  { path: "/nl/service-level-agreement", label: "Service level agreement", legacy: "/service-level-agreement", en: { path: "/en/service-level-agreement", label: "Service level agreement" } },
  { path: "/nl/acceptable-use-policy", label: "Acceptable use policy", legacy: "/acceptable-use-policy", en: { path: "/en/acceptable-use-policy", label: "Acceptable use policy" } },
  { path: "/nl/ai-data-ethiek", label: "AI- en data-ethiek", legacy: "/ai-data-ethiek", en: { path: "/en/ai-and-data-ethics", label: "AI and data ethics" } },
] as const;

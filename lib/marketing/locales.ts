import { LEGAL_PAGES } from "@/lib/site";

/**
 * De website heeft twee talen: Nederlands onder /nl, Engels onder /en. Hier
 * staat welke pagina bij welke hoort, voor de taalknop, hreflang en de
 * sitemap. Een nieuwe pagina in twee talen? Zet het paar hier.
 */

export type SiteLang = "nl" | "en";

export const PAGE_PAIRS: ReadonlyArray<{ nl: string; en: string }> = [
  { nl: "/nl", en: "/en" },
  { nl: "/nl/pricing", en: "/en/pricing" },
  { nl: "/nl/affiliate", en: "/en/affiliate" },
  { nl: "/nl/contact", en: "/en/contact" },
  { nl: "/nl/gratis", en: "/en/free" },
  { nl: "/nl/gratis/antwoordenbank", en: "/en/free/reply-bank" },
  ...LEGAL_PAGES.map((page) => ({ nl: page.path, en: page.en.path })),
];

/** Dezelfde pagina in de andere taal; zonder tegenhanger de homepage van die taal. */
export function counterpart(pathname: string, target: SiteLang): string {
  const pair = PAGE_PAIRS.find((item) => item.nl === pathname || item.en === pathname);
  return pair ? pair[target] : `/${target}`;
}

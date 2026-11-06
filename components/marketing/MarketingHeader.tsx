import type { NavLink } from "@/lib/marketing/products";

import { SiteNavigation } from "./SiteNavigation";

type Props = {
  product?: string;
  homeHref?: string;
  nav?: NavLink[];
  cta?: NavLink;
  showLogin?: boolean;
};

/**
 * Overal dezelfde navigatie: de sitebrede SiteNavigation (Producten,
 * Toepassingen, Bedrijf, Prijzen, Blog). De oude, aparte Support One-balk is
 * weg, zodat je niet van navigatie wisselt als je naar Prijzen gaat.
 * De props blijven bestaan zodat bestaande pagina's niet hoeven te veranderen.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function MarketingHeader(_props: Props) {
  return <SiteNavigation />;
}

import { SITE_ORIGIN } from "@/lib/site";

/**
 * De producten van SequenceFlow. Content One is gearchiveerd tot hij live
 * gaat: hij staat hier nog voor de types en de deelafbeelding, maar geen
 * pagina linkt ernaar (zie archive/content-one/README.md).
 */
export const PRODUCTS = {
  support: {
    name: "Support One",
    href: `${SITE_ORIGIN}/support-one`,
    tagline: "Je AI-collega voor klantenservice en webshopinzicht.",
  },
  content: {
    name: "Content One",
    href: "/content",
    tagline: "Je AI-collega voor social content die je producten verkoopt.",
  },
} as const;

export type NavLink = { href: string; label: string };

/** Menu van de bedrijfspagina, ook gebruikt op blog, contact en juridisch. */
export const SITE_NAV: NavLink[] = [
  { href: PRODUCTS.support.href, label: PRODUCTS.support.name },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

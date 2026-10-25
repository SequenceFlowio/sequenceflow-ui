import { DEFAULT_APP_ORIGIN } from "@/lib/brand";

/**
 * De twee producten die sequenceflow.io uitlicht. De naam van de
 * contentgenerator is een werktitel: pas hem hier aan en hij verandert
 * overal op de website mee.
 */
export const PRODUCTS = {
  support: {
    name: "Support One",
    href: `${DEFAULT_APP_ORIGIN}/`,
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
  { href: PRODUCTS.content.href, label: PRODUCTS.content.name },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

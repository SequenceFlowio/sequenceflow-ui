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

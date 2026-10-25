import type { Metadata } from "next";

import { PRODUCTS } from "@/lib/marketing/products";
import { SITE_ORIGIN } from "@/lib/site";

/**
 * Eén plek voor de metadata van de website. Next.js voegt openGraph en
 * twitter niet samen met die van de root-layout maar vervangt ze; een pagina
 * die alleen een titel zet, deelt dus de Support-app-preview. Daarom bouwt
 * elke pagina hier de hele set, met absolute URL's op het juiste domein.
 */

export type OgVariant = "hub" | "support" | "content";

const SITE_NAMES: Record<OgVariant, string> = {
  hub: "SequenceFlow",
  support: `SequenceFlow ${PRODUCTS.support.name}`,
  content: `SequenceFlow ${PRODUCTS.content.name}`,
};

export const OG_ALT: Record<OgVariant, string> = {
  hub: "SequenceFlow: twee AI-collega's voor je webshop",
  support: `${PRODUCTS.support.name}: je AI-collega voor de supportinbox`,
  content: `${PRODUCTS.content.name}: je AI-collega voor social content`,
};

/** De deelafbeelding staat op de website zelf, zodat hij overal dezelfde is. */
export function ogImageUrl(variant: OgVariant) {
  return `${SITE_ORIGIN}/og/${variant}`;
}

export function pageMetadata({
  path,
  title,
  description,
  variant = "hub",
  shareTitle = title,
  origin = SITE_ORIGIN,
  type = "website",
}: {
  /** Pad op het domein, beginnend met "/". */
  path: string;
  /** Titel in het browsertabblad en in zoekresultaten. */
  title: string;
  description: string;
  /** Welk merk en welke deelafbeelding bij de pagina horen. */
  variant?: OgVariant;
  /** Kortere of pakkendere titel voor social previews. */
  shareTitle?: string;
  /** support.sequenceflow.io voor de Support One-landing, anders de website. */
  origin?: string;
  type?: "website" | "article";
}): Metadata {
  const url = `${origin}${path}`;
  const image = { url: ogImageUrl(variant), width: 1200, height: 630, alt: OG_ALT[variant] };
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title: shareTitle, description, url, siteName: SITE_NAMES[variant], locale: "nl_NL", type, images: [image] },
    twitter: { card: "summary_large_image", title: shareTitle, description, images: [image.url] },
  };
}

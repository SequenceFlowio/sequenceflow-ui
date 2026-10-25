import type { Metadata } from "next";

import { ContentLanding } from "@/components/marketing/ContentLanding";
import { PRODUCTS } from "@/lib/marketing/products";
import { SITE_ORIGIN } from "@/lib/site";

const name = PRODUCTS.content.name;

export const metadata: Metadata = {
  title: `SequenceFlow ${name} | AI-content voor e-commerce`,
  description: `${name} maakt van je producten posts, carrousels en Reel-scripts in jouw merkstem. Organisch verkopen via social media, zonder dat het je avonden kost.`,
  alternates: { canonical: `${SITE_ORIGIN}/content` },
  openGraph: { title: `${name} | Je AI-collega voor social content`, description: "Van productfoto naar post in jouw merkstem. Vraag early access aan.", url: `${SITE_ORIGIN}/content`, siteName: `SequenceFlow ${name}`, locale: "nl_NL", type: "website" },
  twitter: { card: "summary_large_image", title: `${name} | Je AI-collega voor social content`, description: "Van productfoto naar post in jouw merkstem." },
};

export default function ContentPage() {
  return <ContentLanding />;
}

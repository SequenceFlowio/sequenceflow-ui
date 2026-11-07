import type { Metadata } from "next";

import { ContentLanding } from "@/components/marketing/ContentLanding";
import { PRODUCTS } from "@/lib/marketing/products";
import { pageMetadata } from "@/lib/marketing/seo";

const name = PRODUCTS.content.name;

export const metadata: Metadata = pageMetadata({
  path: "/content",
  variant: "content",
  title: `SequenceFlow ${name} | AI-content voor e-commerce`,
  shareTitle: `${name} | Je AI-collega voor social content`,
  description: `${name} maakt van je producten posts, carrousels en Reel-scripts in jouw merkstem. Organisch verkopen via social media, zonder dat het je avonden kost.`,
});

export default function ContentPage() {
  return <ContentLanding />;
}

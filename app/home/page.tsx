import type { Metadata } from "next";

import { HubLanding } from "@/components/marketing/HubLanding";
import { pageMetadata } from "@/lib/marketing/seo";

// Op sequenceflow.io herschrijft proxy.ts / naar deze pagina; de canonieke
// URL is dus de homepage.
export const metadata: Metadata = pageMetadata({
  path: "/",
  variant: "hub",
  title: "SequenceFlow | AI-agents voor e-commerce ondernemers",
  shareTitle: "SequenceFlow | Twee AI-collega's voor je webshop",
  description: "Support One handelt je klantenservice af, Content One maakt social content van je producten. AI-collega's voor webshops, met jou aan het stuur.",
});

export default function HomePage() {
  return <HubLanding />;
}

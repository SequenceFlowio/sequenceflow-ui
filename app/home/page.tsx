import type { Metadata } from "next";

import { HubLanding } from "@/components/marketing/HubLanding";
import { SITE_ORIGIN } from "@/lib/site";

// Op sequenceflow.io herschrijft proxy.ts / naar deze pagina; de canonieke
// URL is dus de homepage.
export const metadata: Metadata = {
  title: "SequenceFlow | AI-agents voor e-commerce ondernemers",
  description: "Support One handelt je klantenservice af, Content One maakt social content van je producten. AI-collega's voor webshops, met jou aan het stuur.",
  alternates: { canonical: `${SITE_ORIGIN}/` },
  openGraph: { title: "SequenceFlow | Twee AI-collega's voor je webshop", description: "Klantenservice en social content voor e-commerce, gedaan door AI-agents die jouw merk kennen.", url: `${SITE_ORIGIN}/`, siteName: "SequenceFlow", locale: "nl_NL", type: "website" },
  twitter: { card: "summary_large_image", title: "SequenceFlow | Twee AI-collega's voor je webshop", description: "Klantenservice en social content voor e-commerce, gedaan door AI-agents." },
};

export default function HomePage() {
  return <HubLanding />;
}

import type { Metadata } from "next";

import { AcademyIndex } from "@/components/marketing/AcademyIndex";
import { MarketingAttribution } from "@/components/marketing/MarketingAttribution";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/nl/academy",
  englishPath: "/en/academy",
  title: "SequenceFlow Academy: uitlegvideo's voor webshops | SequenceFlow",
  shareTitle: "SequenceFlow Academy: korte uitlegvideo's voor webshopondernemers",
  description: "Korte uitlegvideo's van 2 tot 5 minuten over klantenservice, marges, regels, groei en een webshop die verkoopt. Gratis, direct te bekijken na aanmelden.",
});

export default function AcademyPage() {
  return <SitePage><MarketingAttribution page="/nl/academy" /><AcademyIndex lang="nl" /></SitePage>;
}

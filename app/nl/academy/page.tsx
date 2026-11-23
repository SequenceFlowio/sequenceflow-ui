import type { Metadata } from "next";

import { AcademyIndex } from "@/components/marketing/AcademyIndex";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/nl/academy",
  englishPath: "/en/academy",
  title: "SequenceFlow Academy: videocursussen voor webshops | SequenceFlow",
  shareTitle: "SequenceFlow Academy: korte videocursussen voor webshopondernemers",
  description: "Korte videocursussen van zo'n 5 minuten over klantenservice, marges, regels, groei en een webshop die verkoopt. Binnenkort beschikbaar: zet jezelf op de lijst.",
});

export default function AcademyPage() {
  return <SitePage><AcademyIndex lang="nl" /></SitePage>;
}

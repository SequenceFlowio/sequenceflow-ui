import type { Metadata } from "next";

import { SupportOneLanding } from "@/components/marketing/SupportOneLanding";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/support-one",
  englishPath: "/en",
  variant: "support",
  title: "SequenceFlow Support One | Je AI-team voor support en voorraad",
  shareTitle: "Support One | Je AI-team voor support en voorraad",
  description: "Seffy zet bij elke klantmail een antwoord klaar met jouw beleid en de bestelling erbij; Otis houdt je voorraad in de gaten. Jij keurt goed. Start 14 dagen gratis.",
});

export default function SupportOnePage() {
  return <SupportOneLanding />;
}

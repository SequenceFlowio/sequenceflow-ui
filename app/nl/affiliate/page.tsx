import type { Metadata } from "next";

import { AffiliateLanding } from "@/app/affiliate/AffiliateLanding";
import { pageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = pageMetadata({
  path: "/nl/affiliate",
  englishPath: "/en/affiliate",
  title: "Affiliateprogramma | SequenceFlow",
  shareTitle: "Verdien mee met SequenceFlow",
  description: "Stuur webshops naar SequenceFlow en verdien 10% van wat ze betalen, zolang ze klant blijven. Zij krijgen 10% korting op hun eerste maand. Geen account nodig.",
});

// Leaderboard ververst elk uur
export const revalidate = 3600;

export default function AffiliatePage() {
  return <AffiliateLanding lang="nl" />;
}

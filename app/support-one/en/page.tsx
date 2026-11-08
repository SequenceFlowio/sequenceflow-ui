import type { Metadata } from "next";

import { SupportOneLanding } from "@/components/marketing/SupportOneLanding";
import { ogImageUrl } from "@/lib/marketing/seo";

// De Engelse kopie van /support-one. /en stuurt hierheen door.
const url = "https://www.sequenceflow.io/support-one/en";

export const metadata: Metadata = {
  title: "Support One | Your AI team for support and inventory",
  description: "Seffy prepares a reply to every customer email with your policy and the order attached. Otis keeps an eye on your inventory. You approve. Try Support One free for 14 days.",
  openGraph: {
    title: "Support One | Your AI team for support and inventory",
    description: "Seffy prepares customer replies. Otis keeps an eye on your inventory. You stay in control.",
    url, locale: "en_GB", siteName: "SequenceFlow Support One",
    images: [{ url: ogImageUrl("support"), width: 1200, height: 630 }],
  },
  alternates: { canonical: url, languages: { "nl-NL": "https://www.sequenceflow.io/support-one", en: url } },
};

export default function SupportOneEnglishPage() {
  return <SupportOneLanding lang="en" />;
}

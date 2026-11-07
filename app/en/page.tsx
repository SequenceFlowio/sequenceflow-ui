import type { Metadata } from "next";
import { ogImageUrl } from "@/lib/marketing/seo";

import { EnglishFooter, EnglishLanding, EnglishNav } from "@/components/marketing/EnglishSite";

// /en is de Engelse Support One-pagina, zoals /support-one in het Nederlands.
export const metadata: Metadata = {
  title: "Support One | Your AI team for support and inventory",
  description: "Seffy prepares customer replies with your policies and available order data. Otis monitors inventory. You approve. Try Support One free for 14 days.",
  openGraph: {
    title: "Support One | Your AI team for support and inventory",
    description: "Seffy prepares customer replies. Otis monitors inventory. You stay in control.",
    url: "https://www.sequenceflow.io/en", locale: "en_GB", siteName: "SequenceFlow Support One",
    images: [{ url: ogImageUrl("support"), width: 1200, height: 630 }],
  },
  alternates: { canonical: "https://www.sequenceflow.io/en", languages: { "nl-NL": "https://www.sequenceflow.io/support-one", en: "https://www.sequenceflow.io/en" } },
};

export default function EnglishSupportPage() {
  return (
    <div className="mk-page" lang="en">
      <EnglishNav />
      <EnglishLanding />
      <EnglishFooter />
    </div>
  );
}

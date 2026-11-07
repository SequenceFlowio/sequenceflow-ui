import type { Metadata } from "next";

import { ContentOneConcept } from "@/components/marketing/ContentOneConcept";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { SiteNavigation } from "@/components/marketing/SiteNavigation";

export const metadata: Metadata = { title: "Content One (nieuw concept)", robots: { index: false, follow: false } };

/** Ontwerp voor de nieuwe Content One-pagina, voordat die de huidige vervangt. */
export default function ContentOneConceptPage() {
  return (
    <div className="mk-page">
      <SiteNavigation />
      <main id="main-content"><ContentOneConcept /></main>
      <MarketingFooter product="Content One" tagline="AI-content voor e-commerce, met jou aan het stuur." />
    </div>
  );
}

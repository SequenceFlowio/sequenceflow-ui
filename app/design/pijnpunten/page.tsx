import type { Metadata } from "next";

import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PainPointsSection } from "@/components/marketing/PainPointsShowcase";
import { SiteNavigation } from "@/components/marketing/SiteNavigation";

export const metadata: Metadata = { title: "Pijnpunten (voorbeeld)", robots: { index: false, follow: false } };

/** Voorbeeld van de sectie Pijnpunten, voordat die op de supportsite komt. */
export default function PainPointsPreviewPage() {
  return (
    <div className="mk-page">
      <SiteNavigation />
      <main id="main-content">
        <div className="so-story" style={{ paddingTop: 48, paddingBottom: 96 }}>
          <PainPointsSection />
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

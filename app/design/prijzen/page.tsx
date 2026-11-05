import type { Metadata } from "next";

import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { HandledExplainer, PricingCalculator, PricingV2Cards } from "@/components/marketing/PricingV2";
import { SiteNavigation } from "@/components/marketing/SiteNavigation";

export const metadata: Metadata = { title: "Nieuwe prijzen (voorbeeld)", robots: { index: false, follow: false } };

/** Voorbeeld van de nieuwe prijspagina, zolang /pricing nog de huidige prijzen toont. */
export default function PricingPreviewPage() {
  return (
    <div className="mk-page">
      <SiteNavigation />
      <main className="mk-pricing-page" id="main-content">
        <section className="mk-pricing-hero">
          <div className="mk-eyebrow"><span />EERLIJKE PRIJZEN</div>
          <h1>Een vast bedrag. En alleen betalen voor wat echt is afgehandeld.</h1>
          <p>Kies het pakket dat bij je winkel past. Daarbovenop betaal je per klantgesprek dat Support One heeft helpen oplossen, nooit voor concepten, spam of wedervragen. Je stelt zelf een maximum in. Elk account start met 14 dagen gratis, zonder creditcard.</p>
        </section>
        <PricingV2Cards />
        <HandledExplainer />
        <PricingCalculator />
      </main>
      <MarketingFooter />
    </div>
  );
}

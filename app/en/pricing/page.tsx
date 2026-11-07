import type { Metadata } from "next";

import { EnglishFooter, EnglishNav } from "@/components/marketing/EnglishSite";
import { HandledExplainer, PricingCalculator, PricingV2Cards } from "@/components/marketing/PricingV2";

export const metadata: Metadata = {
  title: "Pricing · Support One",
  description: "A fixed monthly plan plus only what actually gets solved. Starter €49, Growth €149, Scale €299, with handled conversations included.",
  alternates: { canonical: "/en/pricing", languages: { "nl-NL": "/pricing", en: "/en/pricing" } },
};

export default function EnglishPricingPage() {
  return (
    <div className="mk-page" lang="en">
      <EnglishNav nlHref="/pricing" />
      <main className="mk-pricing-page" id="main-content">
        <section className="mk-pricing-hero">
          <div className="mk-eyebrow"><span />FAIR PRICING</div>
          <h1>A fixed plan. Solved conversations included.</h1>
          <p>Choose what your team needs. Solved conversations are included; you only pay per conversation above your allowance. Try it free for 14 days, no credit card.</p>
        </section>
        <PricingV2Cards lang="en" />
        <HandledExplainer lang="en" />
        <PricingCalculator lang="en" />
      </main>
      <EnglishFooter />
    </div>
  );
}

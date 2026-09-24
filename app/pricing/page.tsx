import type { Metadata } from "next";

import { MarketingAttribution } from "@/components/marketing/MarketingAttribution";
import { MarketingCta } from "@/components/marketing/MarketingCta";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";

export const metadata: Metadata = {
  title: "Prijzen | SequenceFlow Support One",
  alternates: { canonical: "/pricing" },
  openGraph: { title: "Prijzen | SequenceFlow Support One", url: "/pricing", siteName: "SequenceFlow Support One" },
  description: "Kies het pakket dat past bij het aantal klantvragen van je webshop. Spam en mail die geen klantvraag is tellen niet mee. 14 dagen gratis, zonder creditcard.",
};

const plans = [
  { id: "starter", name: "Starter", price: "49", description: "Voor webshops tot zo'n 50 bestellingen per dag", features: ["100 antwoordconcepten per maand", "1 supportmailbox", "2 teamleden", "25 kennisdocumenten", "Antwoordconcepten ter beoordeling"], cta: "Start met Starter" },
  { id: "growth", name: "Growth", price: "129", description: "Voor groeiende webshops", features: ["400 antwoordconcepten per maand", "1 supportmailbox", "5 teamleden", "100 kennisdocumenten", "Automatisch versturen (optioneel)", "Inzicht, klantpijnpunten en Sefi"], cta: "Start met Growth", recommended: true },
  { id: "scale", name: "Scale", price: "299", description: "Voor grote webshops en hoge volumes", features: ["1.200 antwoordconcepten per maand", "1 supportmailbox", "Onbeperkt teamleden", "Onbeperkt kennisdocumenten", "Automatisch versturen en inplannen", "Prioriteitsondersteuning"], cta: "Start met Scale" },
];

export default function PricingPage() {
  return (
    <div className="mk-page">
      <MarketingAttribution page="/pricing" />
      <MarketingHeader />
      <main className="mk-pricing-page" id="main-content">
        <section className="mk-pricing-hero">
          <div className="mk-eyebrow"><span />EENVOUDIGE MAANDPRIJZEN</div>
          <h1>Begin klein. Automatiseer meer wanneer je team er klaar voor is.</h1>
          <p>Je betaalt per antwoordconcept voor een echte klantvraag. Spam, nieuwsbrieven en mail die geen klantvraag is tellen nooit mee, en je gaat nooit ongemerkt over je pakket heen. Elk account start met 14 dagen gratis en menselijke controle als standaard.</p>
        </section>
        <section className="mk-plan-grid">
          {plans.map((plan) => (
            <article className={plan.recommended ? "mk-plan is-recommended" : "mk-plan"} key={plan.id}>
              {plan.recommended ? <span className="mk-plan-badge">VOOR GROEI</span> : null}
              <p className="mk-plan-name">{plan.name}</p>
              <h2>€{plan.price}<small>/maand</small></h2>
              <p className="mk-plan-description">{plan.description}</p>
              <ul>{plan.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}</ul>
              <MarketingCta href={`/login?intent=signup&plan=${plan.id}`}>{plan.cta}</MarketingCta>
            </article>
          ))}
        </section>
        <section className="mk-pricing-note">
          <h2>Liever dat wij het inrichten?</h2>
          <p>Zelf instellen kost niets. Wil je dat wij het doen, dan richten we voor €490 eenmalig je kennis, antwoordstijl en doorsturen in, testen we met 20 à 30 echte klantvragen en draag je een werkend systeem over aan je team.</p>
          <a href="mailto:hallo@sequenceflow.io?subject=Support%20One%20inrichten">Plan een inrichting →</a>
        </section>
        <section className="mk-pricing-note">
          <h2>Meer dan 1.200 antwoorden per maand of specifieke eisen?</h2>
          <p>We maken een passend volume- en implementatievoorstel zonder functies te beloven die je niet nodig hebt.</p>
          <a href="mailto:hallo@sequenceflow.io?subject=Commerce%20Support%20maatwerk">Bespreek maatwerk →</a>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}

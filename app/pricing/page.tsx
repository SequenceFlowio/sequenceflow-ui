import type { Metadata } from "next";

import { MarketingAttribution } from "@/components/marketing/MarketingAttribution";
import { MarketingCta } from "@/components/marketing/MarketingCta";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";

export const metadata: Metadata = {
  title: "Prijzen | SequenceFlow",
  description: "Kies het SequenceFlow-plan voor jouw e-mailvolume en team. Alle plannen starten met 14 dagen gratis zonder creditcard.",
};

const plans = [
  { name: "Starter", price: "39", description: "Voor kleine webshops en founders", features: ["250 e-mails per maand", "1 supportmailbox", "2 teamleden", "25 kennisdocumenten", "AI-concepten met goedkeuring"], cta: "Start met Starter" },
  { name: "Pro", price: "99", description: "Voor groeiende supportteams", features: ["750 e-mails per maand", "1 supportmailbox", "5 teamleden", "100 kennisdocumenten", "Gecontroleerde auto-send", "Volledige analytics en pijnpunten"], cta: "Start met Pro", recommended: true },
  { name: "Agency", price: "299", description: "Voor grotere teams en hoge volumes", features: ["2.000 e-mails per maand", "1 supportmailbox", "Onbeperkte teamleden", "Onbeperkte kennisdocumenten", "Auto-send en planning", "Prioriteitsondersteuning"], cta: "Start met Agency" },
];

export default function PricingPage() {
  return (
    <div className="mk-page">
      <MarketingAttribution page="/pricing" />
      <MarketingHeader />
      <main className="mk-pricing-page">
        <section className="mk-pricing-hero">
          <div className="mk-eyebrow"><span />EENVOUDIGE MAANDPRIJZEN</div>
          <h1>Begin klein. Automatiseer meer wanneer je team er klaar voor is.</h1>
          <p>Elk account start met 14 dagen gratis, 150 e-mails en menselijke goedkeuring als standaard. Geen creditcard nodig.</p>
        </section>
        <section className="mk-plan-grid">
          {plans.map((plan) => (
            <article className={plan.recommended ? "mk-plan is-recommended" : "mk-plan"} key={plan.name}>
              {plan.recommended ? <span className="mk-plan-badge">VOOR GROEI</span> : null}
              <p className="mk-plan-name">{plan.name}</p>
              <h2>€{plan.price}<small>/maand</small></h2>
              <p className="mk-plan-description">{plan.description}</p>
              <ul>{plan.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}</ul>
              <MarketingCta href={`/login?intent=signup&plan=${plan.name.toLowerCase()}`}>{plan.cta}</MarketingCta>
            </article>
          ))}
        </section>
        <section className="mk-pricing-note">
          <h2>Meer dan 2.000 e-mails per maand of specifieke compliance-eisen?</h2>
          <p>We maken een passend volume- en implementatievoorstel zonder functies te beloven die je niet nodig hebt.</p>
          <a href="mailto:hallo@sequenceflow.io?subject=SequenceFlow%20maatwerk">Bespreek maatwerk →</a>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}

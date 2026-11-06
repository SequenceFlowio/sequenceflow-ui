import type { Metadata } from "next";

import { MarketingAttribution } from "@/components/marketing/MarketingAttribution";
import { MarketingCta } from "@/components/marketing/MarketingCta";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { SiteNavigation } from "@/components/marketing/SiteNavigation";
import { MeetingRequest } from "@/components/marketing/MeetingRequest";
import { pageMetadata } from "@/lib/marketing/seo";
import { PLAN_LIMITS } from "@/lib/billingPlans";
import { formatCount, formatPlanPrice, PAID_PLAN_CATALOG, PRICING_V2_ON } from "@/lib/planCatalog";
import { HandledExplainer, PricingCalculator, PricingV2Cards } from "@/components/marketing/PricingV2";

export const metadata: Metadata = pageMetadata({
  path: "/pricing",
  variant: "support",
  englishPath: "/en/pricing",
  title: "Prijzen | SequenceFlow Support One",
  shareTitle: "Prijzen van Support One",
  description: "Een vast bedrag per maand, plus alleen betalen voor klantgesprekken die echt zijn opgelost. Starter €49, Growth €149, Scale €299. 14 dagen gratis, zonder creditcard.",
});

// Bedragen, volumes en regels komen uit de ene prijslijst (lib/planCatalog.ts).
const plans = PAID_PLAN_CATALOG.map((plan) => ({ ...plan, description: plan.description.nl, features: plan.features.nl, cta: `Start met ${plan.name}` }));
const largestVolume = formatCount(PLAN_LIMITS.agency.aiAnswers);

export default function PricingPage() {
  return (
    <div className="mk-page">
      <MarketingAttribution page="/pricing" />
      {/* Dezelfde navigatie als de rest van de site, ook als je via "Prijzen" binnenkomt. */}
      <SiteNavigation />
      <main className="mk-pricing-page" id="main-content">
        {PRICING_V2_ON ? (
          <>
            <section className="mk-pricing-hero">
              <div className="mk-eyebrow"><span />EERLIJKE PRIJZEN</div>
              <h1>Een vast bedrag. En alleen betalen voor wat echt is afgehandeld.</h1>
              <p>Kies het pakket dat bij je winkel past. Daarbovenop betaal je per klantgesprek dat Support One heeft helpen oplossen, nooit voor concepten, spam of wedervragen. Je stelt zelf een maximum in. Elk account start met 14 dagen gratis, zonder creditcard.</p>
            </section>
            <PricingV2Cards />
            <HandledExplainer />
            <PricingCalculator />
          </>
        ) : (
          <>
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
                  <h2>{formatPlanPrice(plan.price)}<small>/maand</small></h2>
                  <p className="mk-plan-description">{plan.description}</p>
                  <ul>{plan.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}</ul>
                  <MarketingCta href={`/login?intent=signup&plan=${plan.slug}`}>{plan.cta}</MarketingCta>
                </article>
              ))}
            </section>
          </>
        )}
        <section className="mk-pricing-note">
          <h2>Liever dat wij het inrichten?</h2>
          <p>Zelf instellen kost niets. Wil je dat wij het doen, dan richten we voor €490 eenmalig je kennis, antwoordstijl en doorsturen in, testen we met 20 à 30 echte klantvragen en draag je een werkend systeem over aan je team.</p>
          <a href="#aanvraag">Plan een inrichting →</a>
        </section>
        <section className="mk-pricing-note">
          <h2>Meer dan {largestVolume} antwoorden per maand of specifieke eisen?</h2>
          <p>We maken een passend volume- en implementatievoorstel zonder functies te beloven die je niet nodig hebt.</p>
          <a href="#aanvraag">Bespreek maatwerk →</a>
        </section>
        <div className="mk-pricing-form">
          <MeetingRequest
            id="aanvraag"
            eyebrow="INRICHTING OF MAATWERK"
            title="Plan een gesprek."
            intro="Kies een moment en vertel kort wat je nodig hebt. We bespreken de inrichting of een voorstel op maat, zonder verplichtingen."
            bullets={["Inrichting: €490 eenmalig, getest met 20 à 30 echte klantvragen", "We bevestigen je moment binnen één werkdag"]}
            topics={[{ id: "inrichting", label: "Inrichting" }, { id: "maatwerk", label: "Maatwerk" }]}
            submitLabel="Vraag gesprek aan"
          />
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}

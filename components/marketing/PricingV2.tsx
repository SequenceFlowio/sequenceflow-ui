"use client";

import { useState } from "react";

import { MarketingCta } from "@/components/marketing/MarketingCta";
import { formatCents, HANDLED_RATES, monthlyEstimate, PLAN_CATALOG_V2 } from "@/lib/planCatalog";

/**
 * De nieuwe prijzen: een vast bedrag per maand en daarbovenop alleen betalen
 * voor gesprekken die echt zijn afgehandeld. De kaarten zeggen voor wie elk
 * pakket is; daaronder staat wat "afgehandeld" betekent en een rekenhulp met
 * het totaal én de prijs per afgehandeld gesprek.
 */

export function PricingV2Cards() {
  return (
    <section className="mk-plan-grid pv2-grid">
      {PLAN_CATALOG_V2.map((plan) => (
        <article className={plan.recommended ? "mk-plan is-recommended" : "mk-plan"} key={plan.id}>
          {plan.recommended ? <span className="mk-plan-badge">VOOR GROEI</span> : null}
          <p className="mk-plan-name">{plan.name}</p>
          <h2>{formatCents(plan.baseCents)}<small>/maand</small></h2>
          <p className="mk-plan-description">{plan.audience}</p>
          <div className="pv2-usage">
            <span><b>+ {formatCents(HANDLED_RATES.assisted)}</b> per afgehandeld gesprek dat jij controleert</span>
            {plan.autonomous
              ? <span><b>+ {formatCents(HANDLED_RATES.autonomous)}</b> per gesprek dat de AI zelfstandig afhandelt</span>
              : <span className="is-muted">Zelfstandig afhandelen kan vanaf Growth</span>}
          </div>
          <ul>{plan.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}</ul>
          <MarketingCta href={`/login?intent=signup&plan=${plan.slug}`}>Start met {plan.name}</MarketingCta>
        </article>
      ))}
    </section>
  );
}

const RULES = [
  { title: "Een concept kost niets", text: "Je betaalt pas als er een inhoudelijk antwoord naar je klant is gegaan. Een wedervraag of ontvangstbevestiging telt niet." },
  { title: "Pas na 72 uur", text: "Na het antwoord kijken we 72 uur mee. Pas als je klant dan niet terugkomt, telt het gesprek als afgehandeld." },
  { title: "Komt je klant terug? Dan vervalt het", text: "Ook bij een bedankje. Los je het daarna alsnog op, dan telt het hooguit als gecontroleerd. Eén gesprek telt nooit twee keer." },
  { title: "Jij bepaalt het maximum", text: "Stel een maandbudget in. Je krijgt een seintje bij 80%, en boven het budget betaal je niets." },
];

export function HandledExplainer() {
  return (
    <section className="pv2-rules">
      <div className="mk-section-heading"><span>WAAR BETAAL JE VOOR?</span><h2>Alleen voor gesprekken die echt zijn afgehandeld.</h2></div>
      <div className="pv2-rules-grid">
        {RULES.map((rule, index) => (
          <article key={rule.title}><b>{index + 1}</b><h3>{rule.title}</h3><p>{rule.text}</p></article>
        ))}
      </div>
      <p className="pv2-spam">Spam, nieuwsbrieven en mail die geen klantvraag is tellen nooit mee.</p>
    </section>
  );
}

export function PricingCalculator() {
  const [planIndex, setPlanIndex] = useState(1);
  const [assisted, setAssisted] = useState(200);
  const [autonomous, setAutonomous] = useState(200);
  const plan = PLAN_CATALOG_V2[planIndex];
  const auto = plan.autonomous ? autonomous : 0;
  const { totalCents, perHandledCents } = monthlyEstimate(plan.baseCents, assisted, auto);

  return (
    <section className="pv2-calc" aria-labelledby="pv2-calc-title">
      <div className="pv2-calc-copy">
        <span className="pv2-eyebrow">REKENVOORBEELD</span>
        <h2 id="pv2-calc-title">Wat kost het voor jouw winkel?</h2>
        <p>Maandbedrag = abonnement + gecontroleerde gesprekken × {formatCents(HANDLED_RATES.assisted)} + zelfstandige gesprekken × {formatCents(HANDLED_RATES.autonomous)}.</p>
        <p>Zet de prijs per afgehandeld gesprek naast de tijd die je team eraan kwijt zou zijn.</p>
      </div>
      <div className="pv2-calc-panel">
        <div className="pv2-calc-plans" role="radiogroup" aria-label="Pakket">
          {PLAN_CATALOG_V2.map((item, index) => (
            <button key={item.id} type="button" role="radio" aria-checked={index === planIndex} className={index === planIndex ? "is-selected" : ""} onClick={() => setPlanIndex(index)}>
              {item.name} <small>{formatCents(item.baseCents)}</small>
            </button>
          ))}
        </div>
        <label>
          <span>Gesprekken die jij controleert <strong>{assisted}</strong></span>
          <input type="range" min={0} max={1000} step={10} value={assisted} onChange={(event) => setAssisted(Number(event.target.value))} />
        </label>
        <label className={plan.autonomous ? "" : "is-disabled"}>
          <span>Gesprekken die de AI zelfstandig afhandelt <strong>{auto}</strong></span>
          <input type="range" min={0} max={1000} step={10} value={auto} disabled={!plan.autonomous} onChange={(event) => setAutonomous(Number(event.target.value))} />
          {!plan.autonomous ? <small>Kan vanaf Growth</small> : null}
        </label>
        <div className="pv2-calc-result">
          <div><span>Per maand</span><strong>{formatCents(totalCents)}</strong></div>
          <div><span>Per afgehandeld gesprek</span><strong>{perHandledCents === null ? "—" : formatCents(perHandledCents)}</strong><small>inclusief abonnement</small></div>
        </div>
        <p className="pv2-calc-note">Alle prijzen exclusief btw. 14 dagen gratis proberen, zonder creditcard.</p>
      </div>
    </section>
  );
}

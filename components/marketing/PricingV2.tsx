"use client";

import { useState } from "react";

import { MarketingCta } from "@/components/marketing/MarketingCta";
import { cheapestPlan, formatCents, formatCount, HANDLED_RATES, monthlyEstimate, PLAN_CATALOG_V2 } from "@/lib/planCatalog";

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
            <span><b>{formatCount(plan.included)} afgehandelde gesprekken</b> inbegrepen</span>
            <span>Daarboven <b>{formatCents(HANDLED_RATES.assisted)}</b> als jij controleert, <b>{formatCents(HANDLED_RATES.autonomous)}</b> als de AI het zelf afhandelt</span>
            <span className="is-muted">{formatCount(plan.drafts)} antwoordconcepten per maand</span>
          </div>
          {plan.includes ? <p className="pv2-includes">{plan.includes}</p> : null}
          <ul className="pv2-features">
            {plan.features.map((feature) => (
              <li key={feature.text}><span>✓</span><p>{feature.name ? <b>{feature.name}</b> : null}{feature.name ? " " : ""}{feature.text}</p></li>
            ))}
          </ul>
          <MarketingCta href={`/login?intent=signup&plan=${plan.slug}`}>Start met {plan.name}</MarketingCta>
        </article>
      ))}
    </section>
  );
}

const RULES = [
  { title: "Een concept kost niets", text: "Je betaalt pas als er een inhoudelijk antwoord naar je klant is gegaan. Een wedervraag of ontvangstbevestiging telt niet." },
  { title: "Pas na 72 uur", text: "Na het antwoord kijken we 72 uur mee. Pas als je klant dan niet terugkomt, telt het gesprek als afgehandeld." },
  { title: "Komt je klant terug? Dan vervalt het", text: "Met een nieuwe vraag of klacht vervalt de telling. Een kort bedankje telt niet als terugkomen. Los je het daarna alsnog op, dan telt het hooguit als gecontroleerd. Eén gesprek telt nooit twee keer." },
  { title: "Eerst je inbegrepen gesprekken", text: "Elk pakket heeft een aantal afgehandelde gesprekken inbegrepen. Pas daarboven betaal je per gesprek. Stel een maandbudget in: je krijgt een seintje bij 80%, en boven het budget betaal je niets." },
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
  const [planIndex, setPlanIndex] = useState(0);
  const [assisted, setAssisted] = useState(150);
  const [autonomous, setAutonomous] = useState(100);
  const plan = PLAN_CATALOG_V2[planIndex];
  const { totalCents, extra, perHandledCents } = monthlyEstimate(plan.baseCents, assisted, autonomous, plan.included);
  const best = cheapestPlan(assisted, autonomous);
  const saving = totalCents - best.totalCents;

  return (
    <section className="pv2-calc" aria-labelledby="pv2-calc-title">
      <div className="pv2-calc-copy">
        <span className="pv2-eyebrow">REKENVOORBEELD</span>
        <h2 id="pv2-calc-title">Wat kost het voor jouw winkel?</h2>
        <p>Maandbedrag = abonnement + gesprekken boven je inbegrepen aantal × {formatCents(HANDLED_RATES.assisted)} (jij controleert) of {formatCents(HANDLED_RATES.autonomous)} (de AI handelt het zelf af).</p>
        <p>Heb je veel klantvragen, dan is een groter pakket vaak goedkoper. De rekenhulp laat zien welk pakket voor jou het voordeligst is.</p>
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
          <input type="range" min={0} max={1500} step={10} value={assisted} onChange={(event) => setAssisted(Number(event.target.value))} />
        </label>
        <label>
          <span>Gesprekken die de AI zelfstandig afhandelt <strong>{autonomous}</strong></span>
          <input type="range" min={0} max={1500} step={10} value={autonomous} onChange={(event) => setAutonomous(Number(event.target.value))} />
        </label>
        <div className="pv2-calc-result">
          <div><span>Per maand</span><strong>{formatCents(totalCents)}</strong><small>{formatCount(Math.min(plan.included, assisted + autonomous))} inbegrepen, {formatCount(extra)} daarboven</small></div>
          <div><span>Per afgehandeld gesprek</span><strong>{perHandledCents === null ? "—" : formatCents(perHandledCents)}</strong><small>inclusief abonnement</small></div>
        </div>
        {best.plan.id !== plan.id && saving > 0 ? (
          <button type="button" className="pv2-calc-tip" onClick={() => setPlanIndex(PLAN_CATALOG_V2.indexOf(best.plan))}>
            Met {best.plan.name} betaal je {formatCents(best.totalCents)}, dat is {formatCents(saving)} per maand minder →
          </button>
        ) : null}
        <p className="pv2-calc-note">Alle prijzen exclusief btw. 14 dagen gratis proberen, zonder creditcard.</p>
      </div>
    </section>
  );
}

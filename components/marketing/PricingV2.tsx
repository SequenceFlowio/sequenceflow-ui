"use client";

import { useState } from "react";

import { MarketingCta } from "@/components/marketing/MarketingCta";
import { cheapestPlan, formatCents, formatCount, HANDLED_RATES, monthlyEstimate, PLAN_CATALOG_V2 } from "@/lib/planCatalog";

/**
 * De nieuwe prijzen: een vast bedrag per maand en daarbovenop alleen betalen
 * voor gesprekken die echt zijn afgehandeld. De kaarten zeggen voor wie elk
 * pakket is; daaronder staat wat "afgehandeld" betekent en een rekenhulp met
 * het totaal én de prijs per afgehandeld gesprek. Nederlands en Engels.
 */

type Lang = "nl" | "en";

function money(cents: number, lang: Lang) {
  if (lang === "nl") return formatCents(cents);
  const euros = cents / 100;
  return `€${euros.toLocaleString("en-GB", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

export function PricingV2Cards({ lang = "nl" }: { lang?: Lang }) {
  const nl = lang === "nl";
  return (
    <section className="mk-plan-grid pv2-grid">
      {PLAN_CATALOG_V2.map((plan) => (
        <article className={plan.recommended ? "mk-plan is-recommended" : "mk-plan"} key={plan.id}>
          {plan.recommended ? <span className="mk-plan-badge">{nl ? "VOOR GROEI" : "FOR GROWTH"}</span> : null}
          <p className="mk-plan-name">{plan.name}</p>
          <h2>{money(plan.baseCents, lang)}<small>{nl ? "/maand" : "/month"}</small></h2>
          <p className="mk-plan-description">{nl ? plan.audience : plan.audienceEn}</p>
          <div className="pv2-usage">
            <span><b>{formatCount(plan.included, lang)} {nl ? "afgehandelde gesprekken" : "handled conversations"}</b> {nl ? "inbegrepen" : "included"}</span>
            <span>{nl ? "Daarboven" : "Above that"} <b>{money(HANDLED_RATES.assisted, lang)}</b> {nl ? "als jij controleert" : "when you check the reply"}, <b>{money(HANDLED_RATES.autonomous, lang)}</b> {nl ? "als de AI het zelf afhandelt" : "when the AI handles it on its own"}</span>
            <span className="is-muted">{formatCount(plan.drafts, lang)} {nl ? "antwoordconcepten per maand" : "reply drafts per month"}</span>
          </div>
          {plan.includes ? <p className="pv2-includes">{nl ? plan.includes : plan.includesEn}</p> : null}
          <ul className="pv2-features">
            {plan.features.map((feature) => {
              const name = nl ? feature.name : feature.nameEn ?? feature.name;
              const text = nl ? feature.text : feature.textEn ?? feature.text;
              return <li key={feature.text}><span>✓</span><p>{name ? <b>{name}</b> : null}{name ? " " : ""}{text}</p></li>;
            })}
          </ul>
          <MarketingCta href={`/login?intent=signup&plan=${plan.slug}`}>{nl ? `Start met ${plan.name}` : `Start with ${plan.name}`}</MarketingCta>
        </article>
      ))}
    </section>
  );
}

const RULES: Record<Lang, Array<{ title: string; text: string }>> = {
  nl: [
    { title: "Een concept kost niets", text: "Je betaalt pas als er een inhoudelijk antwoord naar je klant is gegaan. Een wedervraag of ontvangstbevestiging telt niet." },
    { title: "Pas na 72 uur", text: "Na het antwoord kijken we 72 uur mee. Pas als je klant dan niet terugkomt, telt het gesprek als afgehandeld." },
    { title: "Komt je klant terug? Dan vervalt het", text: "Een nieuwe vraag of klacht? De telling vervalt. Een bedankje verandert niets. Later alsnog opgelost? Dan telt het maximaal als gecontroleerd, nooit dubbel." },
    { title: "Eerst je inbegrepen gesprekken", text: "Eerst gebruik je de inbegrepen gesprekken, daarna betaal je per gesprek. Je kiest zelf een maandbudget, krijgt een seintje bij 80% en betaalt niets boven je budget." },
  ],
  en: [
    { title: "A draft costs nothing", text: "You only pay once a real answer has gone to your customer. A follow-up question or an acknowledgement never counts." },
    { title: "Only after 72 hours", text: "After the reply we wait 72 hours. Only if your customer doesn't come back does the conversation count as handled." },
    { title: "Customer comes back? It doesn't count", text: "A new question or complaint cancels the count. A short thank-you doesn't. If you solve it later, it counts at most as checked. A conversation never counts twice." },
    { title: "Your included conversations first", text: "Every plan includes a number of handled conversations. You only pay per conversation above that. Set a monthly budget: you get a heads-up at 80%, and above the budget you pay nothing." },
  ],
};

export function HandledExplainer({ lang = "nl" }: { lang?: Lang }) {
  const nl = lang === "nl";
  return (
    <section className="pv2-rules">
      <div className="mk-section-heading"><span>{nl ? "WAAR BETAAL JE VOOR?" : "WHAT DO YOU PAY FOR?"}</span><h2>{nl ? "Je betaalt voor opgelost werk." : "You pay for solved conversations."}</h2></div>
      <div className="pv2-rules-grid">
        {RULES[lang].map((rule, index) => (
          <article key={rule.title}><b>{index + 1}</b><h3>{rule.title}</h3><p>{rule.text}</p></article>
        ))}
      </div>
      <p className="pv2-spam">{nl ? "Spam, nieuwsbrieven en mail die geen klantvraag is tellen nooit mee." : "Spam, newsletters and mail that isn't a customer question never count."}</p>
    </section>
  );
}

export function PricingCalculator({ lang = "nl" }: { lang?: Lang }) {
  const nl = lang === "nl";
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
        <span className="pv2-eyebrow">{nl ? "REKENVOORBEELD" : "CALCULATOR"}</span>
        <h2 id="pv2-calc-title">{nl ? "Wat kost het voor jouw winkel?" : "What would it cost your store?"}</h2>
        <p>{nl
          ? "Je abonnement plus de gesprekken boven je inbegrepen aantal. Kies een pakket en schat je maandelijkse gebruik."
          : "Your plan plus conversations above your included allowance. Choose a plan and estimate your monthly usage."}</p>
        <ul className="pv2-calc-rates"><li><strong>{money(HANDLED_RATES.assisted, lang)}</strong> {nl ? "per extra gesprek dat jij controleert" : "per extra conversation you check"}</li><li><strong>{money(HANDLED_RATES.autonomous, lang)}</strong> {nl ? "per extra gesprek dat de AI zelfstandig afhandelt" : "per extra conversation the AI handles independently"}</li></ul>
        <p className="pv2-calc-hint">{nl ? "Een ander pakket voordeliger? De rekenhulp laat het je zien." : "Would another plan cost less? The calculator will tell you."}</p>
      </div>
      <div className="pv2-calc-panel">
        <div className="pv2-calc-plans" role="radiogroup" aria-label={nl ? "Pakket" : "Plan"}>
          {PLAN_CATALOG_V2.map((item, index) => (
            <button key={item.id} type="button" role="radio" tabIndex={index === planIndex ? 0 : -1} aria-checked={index === planIndex} onKeyDown={event => {
              const count = PLAN_CATALOG_V2.length;
              const next = event.key === "Home" ? 0 : event.key === "End" ? count - 1 : ["ArrowRight", "ArrowDown"].includes(event.key) ? (index + 1) % count : ["ArrowLeft", "ArrowUp"].includes(event.key) ? (index + count - 1) % count : -1;
              if (next < 0) return;
              event.preventDefault(); setPlanIndex(next);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
            }} className={index === planIndex ? "is-selected" : ""} onClick={() => setPlanIndex(index)}>
              {item.name} <small>{money(item.baseCents, lang)}</small>
            </button>
          ))}
        </div>
        <label>
          <span>{nl ? "Gesprekken die jij controleert" : "Conversations you check"} <strong>{assisted}</strong></span>
          <input type="range" min={0} max={1500} step={10} value={assisted} onChange={(event) => setAssisted(Number(event.target.value))} />
        </label>
        <label>
          <span>{nl ? "Gesprekken die de AI zelfstandig afhandelt" : "Conversations the AI handles on its own"} <strong>{autonomous}</strong></span>
          <input type="range" min={0} max={1500} step={10} value={autonomous} onChange={(event) => setAutonomous(Number(event.target.value))} />
        </label>
        <div className="pv2-calc-result">
          <div><span>{nl ? "Per maand" : "Per month"}</span><strong>{money(totalCents, lang)}</strong><small>{nl ? `${formatCount(Math.min(plan.included, assisted + autonomous))} inbegrepen, ${formatCount(extra)} daarboven` : `${formatCount(Math.min(plan.included, assisted + autonomous), "en")} included, ${formatCount(extra, "en")} above`}</small></div>
          <div><span>{nl ? "Per afgehandeld gesprek" : "Per handled conversation"}</span><strong>{perHandledCents === null ? "—" : money(perHandledCents, lang)}</strong><small>{nl ? "inclusief abonnement" : "including your plan"}</small></div>
        </div>
        {best.plan.id !== plan.id && saving > 0 ? (
          <button type="button" className="pv2-calc-tip" onClick={() => setPlanIndex(PLAN_CATALOG_V2.indexOf(best.plan))}>
            {nl ? `Met ${best.plan.name} betaal je ${money(best.totalCents, lang)}, dat is ${money(saving, lang)} per maand minder →` : `With ${best.plan.name} you'd pay ${money(best.totalCents, lang)}, ${money(saving, lang)} less per month →`}
          </button>
        ) : null}
        <p className="pv2-calc-note">{nl ? "Alle prijzen exclusief btw. 14 dagen gratis proberen, zonder creditcard." : "Prices exclude VAT. 14-day free trial, no credit card."}</p>
      </div>
    </section>
  );
}

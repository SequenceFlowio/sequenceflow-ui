"use client";

import { useState } from "react";
import { annualBaseCents } from "@/lib/billingInterval";
import { BillingIntervalToggle, useBillingInterval } from "@/components/BillingIntervalToggle";

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
  const { interval, setInterval } = useBillingInterval();
  return (<>
    <BillingIntervalToggle value={interval} onChange={setInterval} nl={nl} />
    <section className="mk-plan-grid pv2-grid">
      {PLAN_CATALOG_V2.map((plan) => (
        <article className={plan.recommended ? "mk-plan is-recommended" : "mk-plan"} key={plan.id}>
          {plan.recommended ? <span className="mk-plan-badge">{nl ? "VOOR GROEI" : "FOR GROWTH"}</span> : null}
          <p className="mk-plan-name">{plan.name}</p>
          <h2>{money(interval === "year" ? annualBaseCents(plan.baseCents) / 12 : plan.baseCents, lang)}<small>{nl ? "/maand" : "/month"}</small></h2>
          {interval === "year" && <p>{money(annualBaseCents(plan.baseCents), lang)} {nl ? "per jaar vooruit · 20% korting op het abonnement" : "billed yearly · 20% off the subscription"}</p>}
          <p className="mk-plan-description">{nl ? plan.audience : plan.audienceEn}</p>
          <div className="pv2-usage">
            <span><b>{formatCount(plan.included, lang)} {nl ? "afgehandelde gesprekken" : "handled conversations"}</b> {nl ? "per maand inbegrepen" : "included each month"}</span>
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
          <MarketingCta href={`/login?intent=signup&plan=${plan.slug}&interval=${interval}&next=${encodeURIComponent(`/settings?tab=billing&interval=${interval}`)}`}>{nl ? `Start met ${plan.name}` : `Start with ${plan.name}`}</MarketingCta>
        </article>
      ))}
      <p className="pv2-currency-note">{nl ? "Jaarbetaling met 20% korting geldt voor rechtstreeks afsluiten via SequenceFlow; extra gebruik wordt maandelijks afgerekend. Via Shopify is momenteel alleen maandbetaling beschikbaar. Deze europrijzen gelden voor rechtstreeks afsluiten via SequenceFlow. Via de Shopify-app betaal je $47 / $147 / $297 USD per maand en $0,47 / $0,97 per extra gesprek. Shopify rekent zo nodig om naar je factuurvaluta; de uiteindelijke europrijs hangt af van de wisselkoers." : "Annual prepayment with 20% off is available directly through SequenceFlow; extra usage is billed monthly. Shopify currently supports monthly billing only for these usage-based plans. These euro prices apply when subscribing directly through SequenceFlow. Through the Shopify app, plans cost $47 / $147 / $297 USD per month, with $0.47 / $0.97 per extra conversation. Shopify converts to your billing currency where applicable; the final euro amount depends on the exchange rate."}</p>
    </section></>
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
  const { interval, setInterval } = useBillingInterval();
  const [planIndex, setPlanIndex] = useState(0);
  const [total, setTotal] = useState(100);
  const [autonomousPercent, setAutonomousPercent] = useState(0);
  const autonomous = Math.round(total * autonomousPercent / 100);
  const assisted = total - autonomous;
  const plan = PLAN_CATALOG_V2[planIndex];
  const baseCents = interval === "year" ? annualBaseCents(plan.baseCents) / 12 : plan.baseCents;
  const { totalCents, extra, usageCents } = monthlyEstimate(baseCents, assisted, autonomous, plan.included);
  // Allocate the estimate proportionally, matching monthlyEstimate. Round only
  // the displayed conversation split; cents come from the unrounded share.
  const extraAssisted = total ? Math.round(extra * assisted / total) : 0;
  const extraAutonomous = extra - extraAssisted;
  const assistedCents = total ? Math.round(extra / total * assisted * HANDLED_RATES.assisted) : 0;
  const autonomousCents = usageCents - assistedCents;
  const best = interval === "year"
    ? PLAN_CATALOG_V2.map(item => ({ plan: item, ...monthlyEstimate(annualBaseCents(item.baseCents) / 12, assisted, autonomous, item.included) })).sort((a, b) => a.totalCents - b.totalCents)[0]
    : cheapestPlan(assisted, autonomous);
  const saving = totalCents - best.totalCents;
  function selectPlan(index: number) {
    setTotal(PLAN_CATALOG_V2[index].included);
    setPlanIndex(index);
  }
  const filled = (total - plan.included) / (3000 - plan.included) * 100;
  const sliderColor = total > plan.included ? "#f2ad50" : "var(--mk-lime)";



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
        <BillingIntervalToggle value={interval} onChange={setInterval} nl={nl} />
        {interval === "year" && <p className="pv2-calc-allowance">{nl ? `${money(annualBaseCents(plan.baseCents), lang)} per jaar vooraf. Hieronder staat het maandgemiddelde; extra gebruik wordt elke maand apart afgerekend.` : `${money(annualBaseCents(plan.baseCents), lang)} paid yearly in advance. The estimate below is a monthly average; extra usage is billed separately each month.`}</p>}
        <div className="pv2-calc-plans" role="radiogroup" aria-label={nl ? "Pakket" : "Plan"}>
          {PLAN_CATALOG_V2.map((item, index) => (
            <button key={item.id} type="button" role="radio" tabIndex={index === planIndex ? 0 : -1} aria-checked={index === planIndex} onKeyDown={event => {
              const count = PLAN_CATALOG_V2.length;
              const next = event.key === "Home" ? 0 : event.key === "End" ? count - 1 : ["ArrowRight", "ArrowDown"].includes(event.key) ? (index + 1) % count : ["ArrowLeft", "ArrowUp"].includes(event.key) ? (index + count - 1) % count : -1;
              if (next < 0) return;
              event.preventDefault(); selectPlan(next);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
            }} className={index === planIndex ? "is-selected" : ""} onClick={() => selectPlan(index)}>
              {item.name} <small>{money(interval === "year" ? annualBaseCents(item.baseCents) / 12 : item.baseCents, lang)}</small>
            </button>
          ))}
        </div>
        <p className="pv2-calc-allowance">{nl ? `${formatCount(plan.included)} gesprekken per maand inbegrepen. Gecontroleerd én zelfstandig samen. Alleen boven deze bundel betaal je extra.` : `${formatCount(plan.included, "en")} conversations per month included. Checked and autonomous combined. You only pay extra above this allowance.`}</p>
        <label>
          <span>{nl ? "Totaal afgehandelde gesprekken per maand" : "Total handled conversations per month"} <strong>{formatCount(total, lang)}</strong></span>
          <input type="range" min={plan.included} max={3000} step={10} style={{ color: sliderColor, background: `linear-gradient(to right, ${sliderColor} ${filled}%, #30332e ${filled}%)` }} value={total} onChange={event => setTotal(Number(event.target.value))} />
          <small>{nl ? `${formatCount(plan.included)} inbegrepen · ${formatCount(extra)} extra` : `${formatCount(plan.included, "en")} included · ${formatCount(extra, "en")} extra`}</small>
        </label>
        <label>
          <span>{nl ? "Welk deel handelt de AI zelfstandig af?" : "What share does AI handle independently?"} <strong>{autonomousPercent}%</strong></span>
          <input type="range" min={0} max={100} step={5} style={{ color: "var(--mk-lime)", background: `linear-gradient(to right, var(--mk-lime) ${autonomousPercent}%, #30332e ${autonomousPercent}%)` }} value={autonomousPercent} onChange={event => setAutonomousPercent(Number(event.target.value))} />
          <small>{nl ? `${formatCount(assisted)} gecontroleerd + ${formatCount(autonomous)} zelfstandig = ${formatCount(total)} totaal. Binnen je bundel maakt deze verdeling geen verschil voor de prijs.` : `${formatCount(assisted, "en")} checked + ${formatCount(autonomous, "en")} autonomous = ${formatCount(total, "en")} total. Within your allowance, this split does not affect the price.`}</small>
        </label>
        <p className="pv2-calc-allowance" aria-live="polite">{nl ? `${formatCount(assisted + autonomous)} gesprekken totaal: ${formatCount(Math.min(plan.included, assisted + autonomous))} inbegrepen + ${formatCount(extra)} extra (${money(monthlyEstimate(plan.baseCents, assisted, autonomous, plan.included).usageCents, lang)} bovenop je abonnement).` : `${formatCount(assisted + autonomous, "en")} conversations total: ${formatCount(Math.min(plan.included, assisted + autonomous), "en")} included + ${formatCount(extra, "en")} extra (${money(monthlyEstimate(plan.baseCents, assisted, autonomous, plan.included).usageCents, lang)} on top of your plan).`}</p>
        <div className="pv2-calc-breakdown">
          <div><strong>{nl ? "Door jou gecontroleerd" : "Checked by you"}</strong><p>{formatCount(assisted, lang)} {nl ? "gesprekken" : "conversations"} · {formatCount(assisted - extraAssisted, lang)} {nl ? "inbegrepen" : "included"}</p><span>{formatCount(extraAssisted, lang)} {nl ? "extra" : "extra"} × {money(HANDLED_RATES.assisted, lang)} <strong>{money(assistedCents, lang)}</strong></span></div>
          <div><strong>{nl ? "Zelfstandig door de AI" : "Handled independently by AI"}</strong><p>{formatCount(autonomous, lang)} {nl ? "gesprekken" : "conversations"} · {formatCount(autonomous - extraAutonomous, lang)} {nl ? "inbegrepen" : "included"}</p><span>{formatCount(extraAutonomous, lang)} {nl ? "extra" : "extra"} × {money(HANDLED_RATES.autonomous, lang)} <strong>{money(autonomousCents, lang)}</strong></span></div>
        </div>
        <p className="pv2-calc-allowance">{nl ? "Schatting: de inbegrepen bundel wordt hier naar verhouding verdeeld. Op je factuur telt de werkelijke volgorde van afhandeling. Aantallen zijn afgerond." : "Estimate: the included allowance is split proportionally here. Your invoice follows the actual order of completion. Counts are rounded."}</p>
        <div className="pv2-calc-result">
          <div><span>{nl ? "Per maand" : "Per month"}</span><strong>{money(totalCents, lang)}</strong><small>{nl ? `${formatCount(Math.min(plan.included, assisted + autonomous))} inbegrepen, ${formatCount(extra)} daarboven` : `${formatCount(Math.min(plan.included, assisted + autonomous), "en")} included, ${formatCount(extra, "en")} above`}</small></div>
          <div><span>{nl ? "Abonnement" : "Subscription"}</span><strong>{money(baseCents, lang)}</strong><small>{nl ? `${formatCount(plan.included)} gesprekken inbegrepen` : `${formatCount(plan.included, "en")} conversations included`}</small></div>
          <div><span>{nl ? "Extra gesprekken" : "Extra conversations"}</span><strong>{money(usageCents, lang)}</strong><small>{nl ? `${formatCount(extra)} boven je bundel` : `${formatCount(extra, "en")} above your allowance`}</small></div>
        </div>
        {best.plan.id !== plan.id && saving > 0 ? (
          <button type="button" className="pv2-calc-tip" onClick={() => selectPlan(PLAN_CATALOG_V2.indexOf(best.plan))}>
            {nl ? `Met ${best.plan.name} betaal je ${money(best.totalCents, lang)}, dat is ${money(saving, lang)} per maand minder →` : `With ${best.plan.name} you'd pay ${money(best.totalCents, lang)}, ${money(saving, lang)} less per month →`}
          </button>
        ) : null}
        <p className="pv2-calc-note">{nl ? "Alle prijzen exclusief btw. 14 dagen gratis proberen, zonder creditcard." : "Prices exclude VAT. 14-day free trial, no credit card."}</p>
      </div>
    </section>
  );
}

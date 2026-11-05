import type { Metadata } from "next";

import { MarketingAttribution } from "@/components/marketing/MarketingAttribution";
import { SitePage } from "@/components/marketing/SitePage";
import { pageMetadata } from "@/lib/marketing/seo";
import { AFFILIATE, formatEuro } from "@/lib/referrals/program";
import { getLeaderboard } from "@/lib/referrals/server";
import { catalogPlan, formatPlanPrice } from "@/lib/planCatalog";

const growth = catalogPlan("pro");
const euro = (amount: number) => `€${amount.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

import { AffiliateCalculator, AffiliateSignup } from "./AffiliateForms";
import "./affiliate.css";

export const metadata: Metadata = pageMetadata({
  path: "/affiliate",
  title: "Affiliateprogramma | SequenceFlow",
  shareTitle: "Verdien mee met SequenceFlow",
  description: "Stuur webshops naar SequenceFlow en verdien 5% van wat je eerste 5 klanten betalen, en 10% vanaf klant 6. Zolang ze klant blijven, zonder plafond. Geen account nodig.",
});

// Leaderboard ververst elk uur
export const revalidate = 3600;

const FAQ = [
  { q: "Moet ik zelf klant zijn?", a: "Nee. Iedereen kan meedoen: bureaus, freelancers, creators, consultants en tevreden klanten. Ben je klant en wil je alleen een paar ondernemers doorsturen? Dan is doorverwijzen in de app (tegoed op je abonnement) misschien handiger." },
  { q: "Wanneer word ik uitbetaald?", a: `Commissie wordt ${AFFILIATE.holdDays} dagen na de betaling van je klant uitbetaalbaar; zo tellen terugbetalingen en chargebacks niet mee. We betalen één keer per maand uit per bankoverschrijving, vanaf ${formatEuro(AFFILIATE.minPayoutCents)}. Daaronder schuift het door naar de volgende maand.` },
  { q: "Hoe lang verdien ik aan een klant?", a: "Zolang de klant betaalt. Er is geen einddatum en geen maximum aantal klanten." },
  { q: "Wanneer telt een klant als de mijne?", a: "Als die binnen 60 dagen na een klik op jouw link een account aanmaakt. Klikt iemand daarna op de link van een ander, dan telt de laatste klik. Een klant telt als betalend na de eerste betaalde factuur, dus na de gratis proefperiode." },
  { q: "Hoe zit het met factuur en belasting?", a: "Ben je ondernemer, dan maken wij elke maand namens jou de factuur op (self-billing), met btw als je btw-plichtig bent. Doe je mee als particulier, dan moeten we je uitbetalingen mogelijk doorgeven aan de Belastingdienst. Je ontvangt de bedragen dan zonder btw." },
  { q: "Telt een klant die via de Shopify App Store betaalt ook?", a: "Commissie geldt voor abonnementen die bij SequenceFlow zelf worden afgerekend. Abonnementen via de Shopify App Store tellen nog niet mee; dat breiden we later uit." },
];

export default async function AffiliatePage() {
  const leaderboard = await getLeaderboard(10).catch(() => []);
  return (
    <SitePage>
      <MarketingAttribution page="/affiliate" />
      <section className="af-hero">
        <div className="af-hero-label"><div className="mk-eyebrow"><span />AFFILIATEPROGRAMMA</div><span className="af-beta">Beta</span></div>
        <h1>Verdien mee aan elke webshop die je naar ons stuurt.</h1>
        <p>Je krijgt 5% van wat je eerste 5 klanten betalen, en 10% vanaf klant 6. Je verdient zolang ze klant blijven, zonder plafond. Je hebt geen account nodig.</p>
        <p className="af-beta-note">Het programma is in beta: we schaven nog aan de details. Wat je verdient, blijft van jou, en wijzigingen hoor je minstens 30 dagen vooraf.</p>
        <div className="af-hero-actions">
          <a className="mk-button mk-button--primary" href="#aanmelden">Meld je aan</a>
          <a className="mk-button mk-button--secondary" href="#leaderboard">Bekijk het leaderboard</a>
        </div>
      </section>

      <section className="af-tiers" aria-label="Commissie">
        <article><span>Klant 1 t/m 5</span><strong>5%</strong><p>van elke betaling, elke maand</p></article>
        <article className="is-up"><span>Vanaf klant 6</span><strong>10%</strong><p>op elke nieuwe klant die je daarna binnenbrengt</p></article>
        <article><span>Looptijd</span><strong>∞</strong><p>zolang je klant betaalt, zonder maximum</p></article>
      </section>

      <section className="af-split">
        <div>
          <div className="mk-eyebrow"><span />REKENVOORBEELD</div>
          <h2>Wat levert het op?</h2>
          <p>Een webshop op Growth betaalt {formatPlanPrice(growth.price)} per maand. Bij 5% is dat {euro(growth.price * 0.05)} per maand voor jou, bij 10% {euro(growth.price * 0.1)}. Schuif en kijk wat jouw netwerk waard is.</p>
        </div>
        <AffiliateCalculator />
      </section>

      <section className="af-board" id="leaderboard">
        <div className="af-board-head">
          <div>
            <div className="mk-eyebrow"><span />LEADERBOARD</div>
            <h2>Top 10 affiliates</h2>
          </div>
        </div>
        <ol className="af-board-list">
          {leaderboard.map((row, i) => (
            <li key={row.username} className={i < 3 ? "is-top" : undefined}>
              <span className="af-rank">{i + 1}</span>
              <span className="af-user">@{row.username}</span>
              <span className="af-num"><strong>{row.customers}</strong> klanten</span>
              <span className="af-num af-mrr"><strong>{formatEuro(row.estimatedMonthlyCents)}</strong> p/m</span>
            </li>
          ))}
        </ol>
        <p className="af-board-note">Klanten = betalende webshops. Bedrag = geschatte commissie per maand bij het huidige abonnement van hun klanten.</p>
      </section>

      <section className="af-steps">
        <article><span>1</span><h3>Meld je aan</h3><p>Kies een gebruikersnaam. Die komt in je link en op het leaderboard.</p></article>
        <article><span>2</span><h3>Deel je link</h3><p>sequenceflow.io/r/jouwnaam in je content, nieuwsbrief, community of met klanten.</p></article>
        <article><span>3</span><h3>Verdien maandelijks</h3><p>Je ziet in je dashboard wie er klant werd en wat er onderweg is. We betalen elke maand uit.</p></article>
      </section>

      <AffiliateSignup />

      <section className="mk-faq af-faq">
        <div className="mk-section-heading"><span>VEELGESTELDE VRAGEN</span><h2>Goed om te weten</h2></div>
        <div>{FAQ.map((item) => <details key={item.q}><summary>{item.q}<span>+</span></summary><p>{item.a}</p></details>)}</div>
      </section>

      <section className="af-terms" id="voorwaarden">
        <h2>Spelregels</h2>
        <ul>
          <li>Jezelf, je eigen bedrijf of je eigen workspaces doorverwijzen telt niet.</li>
          <li>Niet adverteren op de merknaam SequenceFlow, Support One of Content One, en geen spam, nepreviews of misleidende beloftes.</li>
          <li>Wordt een betaling terugbetaald of teruggeboekt, dan vervalt de commissie daarop.</li>
          <li>Commissie wordt berekend over het betaalde bedrag exclusief btw.</li>
          <li>We kunnen deelname stopzetten bij misbruik. Wijzigen we de regels, dan hoor je dat minstens 30 dagen vooraf; wat je al verdiend hebt, blijft van jou.</li>
        </ul>
      </section>
    </SitePage>
  );
}

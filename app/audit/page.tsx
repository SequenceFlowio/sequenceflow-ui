import type { Metadata } from "next";

import { MarketingAttribution } from "@/components/marketing/MarketingAttribution";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";

export const metadata: Metadata = {
  title: "SupportFlow Pilot | SequenceFlow Commerce Support",
  description: "Eerst een support-audit die meet wat er veilig automatiseerbaar is, daarna een begeleide pilot met een gemeten business case. Vaste prijs, geen maatwerktraject.",
};

const AUDIT_MAILTO = "mailto:hallo@sequenceflow.io?subject=SupportFlow%20Audit%20aanvragen";

const measurements = [
  { title: "Volume en pieken", description: "Hoeveel supportmails komen er per week binnen, waar komen ze vandaan en wanneer loopt de wachtrij op?" },
  { title: "Behandeltijd en kosten", description: "Hoeveel minuten kost een ticket nu en wat betekent dat per maand in medewerkerstijd en euro's? Dat wordt je baseline." },
  { title: "Automatiseerbaarheid", description: "Welke vraagtypen kunnen veilig automatisch, welke vragen om menselijke goedkeuring en wat moet altijd escaleren?" },
];

const steps = [
  ["01", "Support Audit", "We meten je baseline: tickets per week, behandeltijd per ticket en de meest voorkomende vraagtypen. Je ziet vooraf wat er te besparen valt."],
  ["02", "Implementatie in dagen", "We koppelen je bestaande mailbox, laden je retour-, verzend- en productbeleid en stellen de goedkeuringsflow in. Geen ontwikkeltraject, geen migratie."],
  ["03", "Vier weken begeleide pilot", "Je team keurt ieder AI-antwoord goed of stuurt bij. Het dashboard telt ondertussen afgehandelde tickets, bespaarde uren en euro's — op basis van echt verzonden antwoorden."],
];

const included = [
  "Support-audit met baseline-meting",
  "Implementatie en onboarding van je team",
  "4 weken begeleide pilot",
  "Gemeten business case uit je eigen dashboard",
];

const faq = [
  { question: "Is dit een maatwerktraject?", answer: "Nee. SupportFlow bestaat al; de pilot is implementatie plus bewijs, geen ontwikkelproject. Daarom praten we over dagen in plaats van maanden en over een vaste prijs in plaats van een offertetraject." },
  { question: "Wat moeten we aanleveren?", answer: "Toegang tot je supportmailbox via forwarding of IMAP, je retour- en verzendbeleid of FAQ's als documenten, en een eerlijke inschatting van je huidige behandeltijd per ticket voor de baseline." },
  { question: "Wanneer zien we het eerste resultaat?", answer: "De eerste AI-concepten staan meestal binnen enkele dagen na het koppelen van je mailbox klaar. De volledige business case volgt na de pilotperiode van vier weken." },
  { question: "Wat als de cijfers tegenvallen?", answer: "Dan stop je. De business case komt uit je eigen dashboard en is gebaseerd op echt verzonden antwoorden — we tonen nooit verzonnen resultaten. Er is geen lock-in en geen verplichting om door te gaan." },
];

export default function AuditPage() {
  return (
    <div className="mk-page">
      <MarketingAttribution page="/audit" />
      <MarketingHeader />
      <main>
        <section className="mk-pricing-hero">
          <div className="mk-eyebrow"><span />VOOR WEBSHOPS MET SERIEUS VOLUME</div>
          <h1>Geef ons je supportinbox. Wij bewijzen wat er te besparen valt.</h1>
          <p>We brengen eerst in kaart wat veilig automatiseerbaar is. Daarna installeren we SupportFlow. Je team houdt controle over iedere AI-beslissing en in het dashboard zie je precies hoeveel werk en geld het systeem bespaart.</p>
          <div className="mk-hero-actions" style={{ justifyContent: "center", marginTop: 30 }}>
            <a className="mk-button mk-button--primary" href={AUDIT_MAILTO}>Vraag een Support Audit aan</a>
            <a className="mk-text-link" href="#pilot">Bekijk wat de pilot inhoudt <span>↓</span></a>
          </div>
        </section>

        <section className="mk-problem-section">
          <div className="mk-section-heading"><span>WAT DE AUDIT MEET</span><h2>Eerst meten, dan automatiseren.</h2></div>
          <div className="mk-card-grid">
            {measurements.map((item, index) => <article className="mk-feature-card" key={item.title}><b>0{index + 1}</b><h3>{item.title}</h3><p>{item.description}</p></article>)}
          </div>
        </section>

        <section className="mk-workflow" id="pilot">
          <div className="mk-section-heading"><span>ZO WERKT DE PILOT</span><h2>Van audit naar gemeten resultaat in vijf weken.</h2><p>Geen abstracte AI-beloftes. Een vaste route met een meetbaar eindpunt: jouw cijfers, uit jouw inbox.</p></div>
          <div className="mk-workflow-grid">
            {steps.map(([number, title, description]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}
          </div>
        </section>

        <section className="mk-pricing-teaser">
          <div className="mk-section-heading"><span>VASTE PRIJS</span><h2>Eén bedrag. Geen offertetraject.</h2><p>Gaat je webshop na de pilot door met SupportFlow, dan verrekenen we de pilotprijs volledig met je eerste abonnementsmaanden.</p></div>
          <div className="mk-price-card"><div><span>SUPPORTFLOW PILOT</span><h3>€995 <small>eenmalig</small></h3></div><ul>{included.map((item) => <li key={item}>{item}</li>)}</ul><a className="mk-button mk-button--primary" href={AUDIT_MAILTO}>Plan de audit</a></div>
          <a href="/pricing" className="mk-text-link">Bekijk de abonnementen voor daarna →</a>
        </section>

        <section className="mk-faq">
          <div className="mk-section-heading"><span>VEELGESTELDE VRAGEN</span><h2>Voor je de audit aanvraagt.</h2></div>
          <div>{faq.map((item) => <details key={item.question}><summary>{item.question}<span>+</span></summary><p>{item.answer}</p></details>)}</div>
        </section>

        <section className="mk-final-cta"><div className="mk-eyebrow mk-eyebrow--dark"><span />KLAAR OM TE METEN?</div><h2>Eén audit. Vier weken pilot. Daarna beslis je op basis van je eigen cijfers.</h2><a className="mk-button mk-button--primary" href={AUDIT_MAILTO}>Vraag een Support Audit aan</a></section>
      </main>
      <MarketingFooter />
    </div>
  );
}

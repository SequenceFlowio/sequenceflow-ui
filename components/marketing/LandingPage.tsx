import type { LandingPageContent } from "@/lib/marketing/landingPages";

import { MarketingAttribution } from "./MarketingAttribution";
import { MarketingCta } from "./MarketingCta";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";
import { ProductPreview } from "./ProductPreview";

const workflow = [
  ["01", "Koppel je mailbox", "Gebruik forwarding of IMAP voor inkomende mail en SMTP voor antwoorden vanaf je eigen adres."],
  ["02", "Voeg je kennis toe", "Upload retourbeleid, verzending, garantie, FAQ's en productinformatie."],
  ["03", "Beoordeel of automatiseer", "Start met handmatige controle en activeer later alleen de flows die je vertrouwt."],
];

export function LandingPage({ content }: { content: LandingPageContent }) {
  const signupHref = `/login?intent=signup&source=${encodeURIComponent(content.slug)}`;
  return (
    <div className="mk-page">
      <MarketingAttribution page={content.slug === "general" ? "/" : `/for/${content.slug}`} />
      <MarketingHeader />
      <main>
        <section className="mk-hero">
          <div className="mk-hero-copy">
            <div className="mk-eyebrow"><span />{content.eyebrow}</div>
            <h1>{content.title} <em>{content.accent}</em></h1>
            <p>{content.description}</p>
            <div className="mk-hero-actions">
              <MarketingCta href={signupHref}>{content.primaryCta}</MarketingCta>
              <a className="mk-text-link" href="#werking">{content.secondaryCta} <span>↓</span></a>
            </div>
            <div className="mk-trust-row"><span>Geen creditcard nodig</span><span>150 e-mails in je trial</span><span>Menselijke controle standaard</span></div>
          </div>
          <ProductPreview />
        </section>

        <section className="mk-problem-section">
          <div className="mk-section-heading"><span>WAAROM SEQUENCEFLOW</span><h2>{content.painTitle}</h2></div>
          <div className="mk-card-grid">
            {content.pains.map((pain, index) => <article className="mk-feature-card" key={pain.title}><b>0{index + 1}</b><h3>{pain.title}</h3><p>{pain.description}</p></article>)}
          </div>
        </section>

        <section className="mk-workflow" id="werking">
          <div className="mk-section-heading"><span>ZO WERKT HET</span><h2>Van mailbox naar betrouwbare antwoordflow.</h2><p>Geen maandenlange implementatie. Je zet de basis op met de systemen en kennis die je al gebruikt.</p></div>
          <div className="mk-workflow-grid">
            {workflow.map(([number, title, description]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}
          </div>
        </section>

        <section className="mk-outcomes" id="features">
          <div><span className="mk-section-kicker">CONTROLE EN CAPACITEIT</span><h2>{content.outcomeTitle}</h2><MarketingCta href={signupHref}>Probeer het met je eigen inbox</MarketingCta></div>
          <ul>{content.outcomes.map((outcome) => <li key={outcome}><span>✓</span>{outcome}</li>)}</ul>
        </section>

        <section className="mk-pricing-teaser">
          <div className="mk-section-heading"><span>EERST PROBEREN</span><h2>14 dagen om te bewijzen dat het werkt.</h2><p>Start zonder creditcard. Kies pas daarna het plan dat bij je volume en team past.</p></div>
          <div className="mk-price-card"><div><span>GRATIS PROEFPERIODE</span><h3>€0 <small>/ 14 dagen</small></h3></div><ul><li>150 verwerkte e-mails</li><li>1 supportmailbox</li><li>1 gebruiker</li><li>10 kennisdocumenten</li></ul><MarketingCta href={signupHref}>Start gratis</MarketingCta></div>
          <a href="/pricing" className="mk-text-link">Bekijk alle plannen →</a>
        </section>

        <section className="mk-faq">
          <div className="mk-section-heading"><span>VEELGESTELDE VRAGEN</span><h2>Voor je je mailbox koppelt.</h2></div>
          <div>{content.faq.map((item) => <details key={item.question}><summary>{item.question}<span>+</span></summary><p>{item.answer}</p></details>)}</div>
        </section>

        <section className="mk-final-cta"><div className="mk-eyebrow mk-eyebrow--dark"><span />KLAAR VOOR EEN RUSTIGERE INBOX?</div><h2>Laat SequenceFlow het repetitieve werk doen. Houd zelf de beslissingen.</h2><MarketingCta href={signupHref}>Start 14 dagen gratis</MarketingCta></section>
      </main>
      <MarketingFooter />
    </div>
  );
}

import { LANDING_PAGES } from "@/lib/marketing/landingPages";

import { InboxScenarios } from "./InboxScenarios";
import { LiveInboxDemo } from "./LiveInboxDemo";
import { MarketingAttribution } from "./MarketingAttribution";
import { MarketingCta } from "./MarketingCta";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";
import { Reveal } from "./Reveal";
import { SequenceMark } from "./SequenceMark";
import { SupportAgents } from "./SupportAgents";
import { SupportFeatureCards } from "./SupportFeatureCards";

/**
 * Testvariant /s1 van de Support One-landing: dezelfde inhoud, minder
 * leeswerk. De functies staan als kaarten die je openklikt voor meer uitleg,
 * in plaats van zes lange secties onder elkaar.
 */

const SIGNUP = "/login?intent=signup&source=s1";
const content = LANDING_PAGES.general;

const STEPS = [
  ["Koppel je mailbox", "Forwarding of IMAP, en versturen vanaf je eigen adres."],
  ["Voeg je kennis toe", "Je beleid en productinfo. Je webshop koppelen kan later."],
  ["Keur je eerste concept goed", "Lees, pas aan en verstuur. Jij beslist."],
];

export function SupportOneS1() {
  return (
    <div className="mk-page s1">
      <MarketingAttribution page="/s1" />
      <MarketingHeader />
      <main id="main-content">
        <section className="mk-hero">
          <div className="mk-hero-copy">
            <div className="mk-eyebrow mk-enter"><span />Support One · AI-klantenservice</div>
            <h1 className="mk-enter mk-enter--1">
              {/* De mascotte in de titel, zoals op de huidige Support One-pagina. */}
              <span className="mk-hero-title-line">Je <SequenceMark className="mk-title-mark" state="happy" followPointer={520} title="" /> klantmails,</span>
              <em>al voorbereid.</em>
            </h1>
            <p className="mk-enter mk-enter--2">Support One zet bij elke klantvraag een antwoord klaar, met jouw beleid en de bestelling erbij. Jij keurt goed.</p>
            <div className="mk-hero-actions mk-enter mk-enter--3">
              <MarketingCta href={SIGNUP}>Start 14 dagen gratis</MarketingCta>
              <a className="mk-text-link" href="#functies">Wat het doet <span>↓</span></a>
            </div>
            <div className="mk-trust-row mk-enter mk-enter--4"><span>Geen creditcard nodig</span><span>150 AI-antwoorden in je trial</span><span>Jij keurt alles goed</span></div>
          </div>
          <div className="mk-hero-demo mk-enter mk-enter--2"><LiveInboxDemo /></div>
        </section>

        <SupportAgents />

        <Reveal as="section" className="s1-features" id="functies">
          <SupportFeatureCards />
        </Reveal>

        <Reveal as="section" className="s1-steps">
          <div className="s1-heading"><span className="mk-section-kicker">ZO BEGIN JE</span><h2>Binnen een middag aan de slag.</h2></div>
          <ol>
            {STEPS.map(([title, text], index) => <li key={title}><span>{index + 1}</span><div><strong>{title}</strong><p>{text}</p></div></li>)}
          </ol>
          <div className="s1-trial">
            <div><strong>14 dagen gratis</strong><span>150 AI-antwoorden · 1 mailbox · geen creditcard</span></div>
            <MarketingCta href={SIGNUP}>Start gratis</MarketingCta>
            <a href="/pricing" className="mk-text-link">Alle plannen →</a>
          </div>
        </Reveal>

        <InboxScenarios />

        <Reveal as="section" className="mk-faq">
          <div className="mk-section-heading"><span>VEELGESTELDE VRAGEN</span><h2>Voor je je mailbox koppelt.</h2></div>
          <div>{content.faq.map((item) => <details key={item.question}><summary>{item.question}<span>+</span></summary><p>{item.answer}</p></details>)}</div>
        </Reveal>

        <section className="h1-final">
          <SequenceMark size={64} state="happy" gear="headset" title="" />
          <h2>Probeer het met je eigen inbox.</h2>
          <p>14 dagen gratis, zonder creditcard. Jij houdt de controle.</p>
          <div className="h1-final-actions">
            <MarketingCta href={SIGNUP}>Start 14 dagen gratis</MarketingCta>
            <MarketingCta href="/contact" variant="secondary">Plan een kennismaking</MarketingCta>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}

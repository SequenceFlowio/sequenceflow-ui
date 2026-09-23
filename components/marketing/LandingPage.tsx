import type { LandingPageContent } from "@/lib/marketing/landingPages";

import { MarketingAttribution } from "./MarketingAttribution";
import { MarketingCta } from "./MarketingCta";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";
import { SupportStory } from "./SupportStory";
import { LiveInboxDemo } from "./LiveInboxDemo";
import { Reveal } from "./Reveal";
import { SequenceMark } from "./SequenceMark";

const workflow = [
  ["01", "Koppel je mailbox", "Kies hoe je klantvragen ontvangt en stel verzending vanaf je supportadres in."],
  ["02", "Voeg je kennis toe", "Voeg je beleid en productinformatie toe. Een webshopkoppeling voor bestelgegevens is een aparte, optionele stap."],
  ["03", "Bekijk je eerste concept", "Lees het antwoord, pas het aan en beslis zelf wat je verstuurt."],
];

export function LandingPage({ content }: { content: LandingPageContent }) {
  const signupHref = `/login?intent=signup&source=${encodeURIComponent(content.slug)}`;
  return (
    <div className="mk-page">
      <MarketingAttribution page={content.slug === "general" ? "/" : `/for/${content.slug}`} />
      <MarketingHeader />
      <main id="main-content">
        {/* De hero animeert bij het laden, niet bij het scrollen: hij staat al
            in beeld. De mk-enter-klassen staffelen de regels. */}
        <section className="mk-hero">
          <div className="mk-hero-copy">
            <div className="mk-eyebrow mk-enter"><span />{content.eyebrow}</div>
            <h1 className="mk-enter mk-enter--1">
              <SequenceMark className="mk-title-mark" state="happy" followPointer={520} title="" />{" "}
              {content.title} <em>{content.accent}</em>
            </h1>
            <p className="mk-enter mk-enter--2">{content.description}</p>
            <div className="mk-hero-actions mk-enter mk-enter--3">
              <MarketingCta href={signupHref}>{content.primaryCta}</MarketingCta>
              <a className="mk-text-link" href="#voorbeelden">{content.secondaryCta} <span>↓</span></a>
            </div>
            <div className="mk-trust-row mk-enter mk-enter--4"><span>Geen creditcard nodig</span><span>150 AI-antwoorden in je trial</span><span>Menselijke controle standaard</span></div>
          </div>
          <div className="mk-hero-demo mk-enter mk-enter--2">
            <LiveInboxDemo />
          </div>
        </section>

        {content.painTitle && content.pains && (
          <Reveal as="section" className="so-audience">
            <div className="so-audience-head">
              <span className="mk-section-kicker">WAAROM SUPPORT ONE</span>
              <h2>{content.painTitle}</h2>
            </div>
            <div className="so-audience-grid">
              {content.pains.map((pain, index) => (
                <Reveal as="article" className="so-audience-card" delay={index * 90} key={pain.title}>
                  <span className="so-audience-dot" aria-hidden />
                  <h3>{pain.title}</h3>
                  <p>{pain.description}</p>
                </Reveal>
              ))}
            </div>
            {content.outcomes && (
              <div className="so-audience-outcomes">
                {content.outcomeTitle && <p>{content.outcomeTitle}</p>}
                <ul>{content.outcomes.map((outcome) => <li key={outcome}><span aria-hidden>✓</span>{outcome}</li>)}</ul>
              </div>
            )}
          </Reveal>
        )}

        <SupportStory />

        <Reveal as="section" className="mk-workflow" id="werking">
          <div className="mk-section-heading"><span>ZO WERKT HET</span><h2>In drie stappen aan de slag.</h2><p>Begin met je mailbox, je kennis en één klantvraag. Bouw vertrouwen op voordat je meer automatiseert.</p></div>
          <div className="mk-workflow-grid">
            {workflow.map(([number, title, description], index) => (
              <Reveal as="article" delay={index * 90} key={number}>
                <span>{number}</span><h3>{title}</h3><p>{description}</p>
              </Reveal>
            ))}
          </div>
        </Reveal>

        <Reveal as="section" className="mk-pricing-teaser">
          <div className="mk-section-heading"><span>EERST PROBEREN</span><h2>14 dagen om te bewijzen dat het werkt.</h2><p>Start zonder creditcard. Kies pas daarna het plan dat bij je volume en team past.</p></div>
          <div className="mk-price-card"><div><span>GRATIS PROEFPERIODE</span><h3>€0 <small>/ 14 dagen</small></h3></div><ul><li>150 AI-antwoorden</li><li>1 supportmailbox</li><li>1 gebruiker</li><li>10 kennisdocumenten</li></ul><MarketingCta href={signupHref}>Start gratis</MarketingCta></div>
          <a href="/pricing" className="mk-text-link">Bekijk alle plannen →</a>
        </Reveal>

        <Reveal as="section" className="mk-faq">
          <div className="mk-section-heading"><span>VEELGESTELDE VRAGEN</span><h2>Voor je je mailbox koppelt.</h2></div>
          <div>{content.faq.map((item) => <details key={item.question}><summary>{item.question}<span>+</span></summary><p>{item.answer}</p></details>)}</div>
        </Reveal>

        <Reveal as="section" className="mk-final-cta">
          <div className="mk-final-cta-content">
            <div className="mk-eyebrow"><span />JOUW NIEUWE SUPPORTCOLLEGA</div>
            <h2>Maak kennis met Support One.</h2>
            <p>AI-concepten voor elke klantvraag, met jouw team aan het stuur.</p>
            <div className="mk-final-cta-actions">
              <MarketingCta href={signupHref}>Start 14 dagen gratis</MarketingCta>
              <a href="mailto:hallo@sequenceflow.io?subject=Kennismaking%20Support%20One" className="mk-final-contact">Plan een kennismaking</a>
            </div>
          </div>
          <div className="mk-final-cta-art" aria-hidden="true"><SequenceMark className="mk-final-cta-mark" size={880} variant="outline" title="" /></div>
        </Reveal>
      </main>
      <MarketingFooter />
    </div>
  );
}

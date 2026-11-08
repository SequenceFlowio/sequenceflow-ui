import { DEFAULT_APP_ORIGIN } from "@/lib/brand";
import { LANDING_PAGES } from "@/lib/marketing/landingPages";
import { PRICING_V2_ON } from "@/lib/planCatalog";

import { EnglishFooter, EnglishNav } from "./EnglishSite";

import { HeroVideo } from "./HeroVideo";
import { HeroSeffy } from "./HeroSeffy";
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
 * De Support One-landing op sequenceflow.io/support-one (ook de bestemming van
 * sequenceflow.io/ zolang er één product is). Eerst het team, Seffy en Otis;
 * hun functies staan als kaarten die je openklikt voor meer uitleg.
 *
 * lang="en" is dezelfde pagina in het Engels op /support-one/en. De video is
 * Nederlandstalig en staat daar (nog) niet op.
 */

const content = LANDING_PAGES.general;

const COPY = {
  nl: {
    eyebrow: "Support One · voor webshops", hi: "Je", team: "AI-team", accent: "voor support en voorraad.",
    lead: "Seffy zet bij elke klantmail een antwoord klaar, met jouw beleid en de bestelling erbij. Otis houdt je voorraad in de gaten. Jij keurt goed.",
    start: "Start 14 dagen gratis", meet: "Maak kennis met het team", trust: ["Geen creditcard nodig", "150 AI-antwoorden in je trial", "Jij keurt alles goed"],
    demoKicker: "PROBEER SEFFY", demoTitle: "Zie Seffy een klantmail voorbereiden.", demoText: "Kies een vraag, pas het concept aan of keur het goed. Dit is een simulatie.",
    stepsKicker: "ZO BEGIN JE", stepsTitle: "Binnen een middag aan de slag.",
    steps: [["Koppel je mailbox", "Forwarding of IMAP, en versturen vanaf je eigen adres."], ["Voeg je kennis toe", "Je beleid en productinfo. Je webshop koppelen kan later."], ["Keur je eerste concept goed", "Lees, pas aan en verstuur. Jij beslist."]],
    trialTitle: "14 dagen gratis", trialText: "150 AI-antwoorden · 1 mailbox · geen creditcard", trialCta: "Start gratis", plans: "Alle plannen →", pricing: "/pricing",
    faqKicker: "VEELGESTELDE VRAGEN", faqTitle: "Voor je je mailbox koppelt.", faq: content.faq,
    finalTitle: "Probeer het met je eigen inbox.", finalText: "14 dagen gratis, zonder creditcard. Jij houdt de controle.", finalMeet: "Plan een kennismaking",
  },
  en: {
    eyebrow: "Support One · for online stores", hi: "Your", team: "AI team", accent: "for support and inventory.",
    lead: "Seffy prepares a reply to every customer email, with your policy and the order attached. Otis keeps an eye on your inventory. You approve.",
    start: "Start your 14-day free trial", meet: "Meet the team", trust: ["No credit card needed", "150 AI replies in your trial", "You approve everything"],
    demoKicker: "TRY SEFFY", demoTitle: "Watch Seffy prepare a customer email.", demoText: "Pick a question, edit the draft or approve it. This is a simulation.",
    stepsKicker: "HOW TO START", stepsTitle: "Up and running in an afternoon.",
    steps: [["Connect your mailbox", "Forwarding or IMAP, and sending from your own address."], ["Add your knowledge", "Your policies and product info. Connecting your store can wait."], ["Approve your first draft", "Read, edit and send. You decide."]],
    trialTitle: "14 days free", trialText: "150 AI replies · 1 mailbox · no credit card", trialCta: "Start free", plans: "All plans →", pricing: "/en/pricing",
    faqKicker: "FREQUENTLY ASKED QUESTIONS", faqTitle: "Before you connect your mailbox.",
    faq: [
      { question: "Does Support One work with Shopify or WooCommerce?", answer: "Yes, for customer questions that arrive in your connected support mailbox. Without a separate store connection, Support One can't fetch a live Shopify or WooCommerce order status yet. The bol connection for order context is available; we're piloting Shopify with one customer first, then WooCommerce." },
      { question: "Why are there two connections?", answer: "Your mailbox receives customer questions and sends replies. A store connection is a separate, optional source of live order data. Without it, Support One uses the question and your business knowledge, but never makes up an order status." },
      { question: "Does Support One process returns or refunds?", answer: "Support One helps your team with reply drafts and the available context. It doesn't currently process returns, cancellations or refunds in your store." },
      { question: "Does Support One send replies automatically?", answer: `Not by default. New accounts start with human approval. Auto-send is optional, included in ${PRICING_V2_ON ? "every paid plan" : "Growth and Scale"}, and asks for explicit confirmation when you turn it on. You set how confident Support One must be and when it sends.` },
      { question: "Does it work with our current mailbox?", answer: "You can connect incoming mail via forwarding or IMAP and set up outgoing replies via SMTP. The steps differ per mail provider. Gmail, for example, may need an app password." },
      { question: "Are our emails used to train AI models?", answer: "No. We use the OpenAI API for reply drafts, not ChatGPT. Data processed through the API isn't used by OpenAI to train models by default. OpenAI may keep it for up to 30 days for abuse monitoring. Our privacy statement has the details." },
    ],
    finalTitle: "Try it with your own inbox.", finalText: "14 days free, no credit card. You stay in control.", finalMeet: "Book a call",
  },
};

export function SupportOneLanding({ lang = "nl" }: { lang?: "nl" | "en" }) {
  const en = lang === "en";
  const c = COPY[lang];
  const SIGNUP = `${DEFAULT_APP_ORIGIN}/login?intent=signup&source=${en ? "support-one-en" : "support-one"}`;
  return (
    <div className="mk-page s1" lang={lang}>
      <MarketingAttribution page={en ? "/support-one/en" : "/support-one"} />
      {en ? <EnglishNav /> : <MarketingHeader />}
      <main id="main-content">
        <section className="mk-hero">
          <div className="mk-hero-copy">
            <div className="mk-eyebrow mk-enter"><span />{c.eyebrow}</div>
            <h1 className="mk-enter mk-enter--1">
              {/* De mascotte in de titel, zoals op de huidige Support One-pagina. */}
              <span className="mk-hero-title-line">{c.hi} <HeroSeffy className="mk-title-mark" /> {c.team}</span>
              <em>{c.accent}</em>
            </h1>
            <p className="mk-enter mk-enter--2">{c.lead}</p>
            <div className="mk-hero-actions mk-enter mk-enter--3">
              <MarketingCta href={SIGNUP}>{c.start}</MarketingCta>
              <a className="mk-text-link" href="#team">{c.meet} <span>↓</span></a>
            </div>
            <div className="mk-trust-row mk-enter mk-enter--4">{c.trust.map((item) => <span key={item}>{item}</span>)}</div>
          </div>
          {!en && <div className="mk-hero-demo mk-enter mk-enter--4"><HeroVideo /></div>}
        </section>

        <SupportAgents lang={lang} />

        <Reveal as="section" className="s1-features" id="functies">
          <SupportFeatureCards lang={lang} />
        </Reveal>

        {/* De demo is alleen klantmail, dus hij staat na het team en de kaarten:
            eerst weet je wie Seffy is, dan zie je Seffy aan het werk. */}
        <Reveal as="section" className="s1-demo" id="demo">
          <div className="s1-heading s1-heading--mark">
            <SequenceMark size={56} gear="headset" state="happy" title="" />
            <span className="mk-section-kicker">{c.demoKicker}</span>
            <h2>{c.demoTitle}</h2>
            <p>{c.demoText}</p>
          </div>
          <LiveInboxDemo lang={lang} />
        </Reveal>

        <Reveal as="section" className="s1-steps">
          <div className="s1-heading"><span className="mk-section-kicker">{c.stepsKicker}</span><h2>{c.stepsTitle}</h2></div>
          <ol>
            {c.steps.map(([title, text], index) => <li key={title}><span>{index + 1}</span><div><strong>{title}</strong><p>{text}</p></div></li>)}
          </ol>
          <div className="s1-trial">
            <div><strong>{c.trialTitle}</strong><span>{c.trialText}</span></div>
            <MarketingCta href={SIGNUP}>{c.trialCta}</MarketingCta>
            <a href={c.pricing} className="mk-text-link">{c.plans}</a>
          </div>
        </Reveal>

        <InboxScenarios lang={lang} />

        <Reveal as="section" className="mk-faq">
          <div className="mk-section-heading"><span>{c.faqKicker}</span><h2>{c.faqTitle}</h2></div>
          <div>{c.faq.map((item) => <details key={item.question}><summary>{item.question}<span>+</span></summary><p>{item.answer}</p></details>)}</div>
        </Reveal>

        <section className="h1-final">
          <SequenceMark size={64} state="happy" gear="headset" title="" />
          <h2>{c.finalTitle}</h2>
          <p>{c.finalText}</p>
          <div className="h1-final-actions">
            <MarketingCta href={SIGNUP}>{c.start}</MarketingCta>
            <MarketingCta href="/contact" variant="secondary">{c.finalMeet}</MarketingCta>
          </div>
        </section>
      </main>
      {en ? <EnglishFooter /> : <MarketingFooter />}
    </div>
  );
}

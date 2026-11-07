import Image from "next/image";
import { ArrowRight, Camera, Check, Inbox, LineChart, Mail, Package, ShieldCheck, Store } from "lucide-react";

import { DEFAULT_APP_ORIGIN } from "@/lib/brand";
import { PRODUCTS } from "@/lib/marketing/products";

import { BetaSignup } from "./BetaSignup";
import { MarketingAttribution } from "./MarketingAttribution";
import { MarketingCta } from "./MarketingCta";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";
import { SequenceMark } from "./SequenceMark";
import { TileLink } from "./TileLink";

/**
 * Homepagevariant /h1: een korte introductie en een keuze, geen verkooppagina.
 * Wie ons niet kent, moet in vijf seconden zien wat we doen en waar hij heen
 * kan. Support One is live en krijgt de grote, felle tegel; Content One is in
 * ontwikkeling en krijgt een kleinere tegel met een beta-aanmelding. De uitleg
 * en de video staan op de productpagina's, waar ook de advertenties heen gaan.
 */

const support = PRODUCTS.support;
const content = PRODUCTS.content;
const SIGNUP = `${DEFAULT_APP_ORIGIN}/login?intent=signup&source=h1`;

const PROBLEMS = [
  { icon: Inbox, title: "Elke dag dezelfde klantvragen", text: "Waar blijft mijn pakket? Kan ik ruilen? Elke klant verdient snel een goed antwoord, maar het blijft handwerk.", agent: `Dat doet ${support.name}`, soon: false },
  { icon: Camera, title: "Content die altijd achterloopt", text: "Je weet dat je moet posten om te verkopen, maar foto's, captions en een planning schieten er steeds bij in.", agent: `Dat wordt ${content.name} · binnenkort`, soon: true },
  { icon: LineChart, title: "Signalen die je te laat ziet", text: "Een klacht die blijft terugkomen, een product dat bijna op is. Het zit verspreid over je mail en je webshop.", agent: `Dat ziet ${support.name}`, soon: false },
];

export function HomeVariantH1() {
  return (
    <div className="mk-page h1">
      <MarketingAttribution page="/h1" />
      <MarketingHeader />
      <main id="main-content">
        <section className="h1-intro">
          <div className="mk-eyebrow mk-enter"><span />SequenceFlow</div>
          <h1 className="mk-enter mk-enter--1">AI-collega&apos;s voor je webshop.</h1>
          <p className="mk-enter mk-enter--2">Wij bouwen AI-agents die het terugkerende werk van je webshop overnemen. Jij houdt de controle.</p>
        </section>

        <section className="h1-apps mk-enter mk-enter--3" aria-label="Onze apps">
          <article className="h1-tile h1-tile--support">
            <TileLink href={support.href} label={`Bekijk ${support.name}`} />
            <div className="h1-tile-copy">
              <div className="h1-tile-top"><span className="h1-badge h1-badge--live">Live</span><span className="h1-kind">Klantenservice</span></div>
              <h2>{support.name}</h2>
              <p>Beantwoordt je klantmails in jouw stijl, met de bestelling en je beleid erbij. Jij keurt goed.</p>
              <span className="h1-more">Bekijk {support.name} <ArrowRight size={16} /></span>
            </div>

            {/* Mini-demo: loopt in een lus van vraag naar goedgekeurd antwoord. */}
            <div className="h1-demo" aria-label="Voorbeeld: een klantvraag, de gevonden bestelling en het antwoordconcept" role="img">
              <div className="h1-card h1-step h1-step--1">
                <Mail size={16} />
                <div><strong>Sanne · klantvraag</strong><span>Waar blijft mijn bestelling?</span></div>
              </div>
              <div className="h1-chip h1-step h1-step--2"><Package size={14} /> Bestelling #1043 · onderweg</div>
              <div className="h1-card h1-card--reply h1-step h1-step--3">
                <SequenceMark size={30} gear="headset" title="" />
                <div><strong>Antwoordconcept</strong><span>Hoi Sanne, je bestelling is onderweg met PostNL en komt morgen aan.</span></div>
              </div>
              <div className="h1-ready h1-step h1-step--4"><Check size={15} strokeWidth={3} /> Klaar om te checken</div>
            </div>
          </article>

          <article className="h1-tile h1-tile--content">
            <TileLink href={content.href} label={`Bekijk ${content.name}`} />
            <div className="h1-tile-top"><span className="h1-badge h1-badge--soon">Binnenkort · beta</span><span className="h1-kind">Social content</span></div>
            <h2>{content.name}</h2>
            <p>Maakt van je producten social posts in jouw merkstijl.</p>
            <div className="h1-posts" aria-hidden="true">
              {["content-post", "content-example-carousel", "content-example-ugc"].map((photo) => (
                <div key={photo}><Image src={`/media/site/${photo}.jpg`} alt="" fill sizes="140px" /></div>
              ))}
            </div>
            <span className="h1-more">Bekijk {content.name} <ArrowRight size={16} /></span>
            <div className="h1-raise"><BetaSignup /></div>
          </article>
        </section>

        <section className="h1-problem">
          <div className="h1-heading">
            <span className="mk-section-kicker">HET PROBLEEM</span>
            <h2>Een webshop runnen is tien banen tegelijk.</h2>
            <p>Inkoop, marketing, klantenservice, inpakken. Het werk dat elke dag terugkomt, slokt de tijd op die je in je merk wilt steken.</p>
          </div>
          <div className="h1-problem-grid">
            {PROBLEMS.map(({ icon: Icon, title, text, agent, soon }) => (
              <article key={title}>
                <span className="h1-problem-icon"><Icon size={20} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
                <small className={soon ? "is-soon" : ""}>{agent}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="h1-about">
          <div className="h1-about-copy">
            <span className="h1-about-kicker">OVER SEQUENCEFLOW</span>
            <h2>AI die met je meewerkt. Niet in je plaats.</h2>
            <p>We zijn een Nederlands team dat AI-agents bouwt voor webshops. Geen chatbot die je klanten afschept, maar collega&apos;s die je producten, je beleid en je toon kennen, en die jou laten beslissen.</p>
          </div>
          <div className="h1-about-grid">
            <div><Store size={20} /><strong>Jouw kennis</strong><span>Ze werken met je eigen beleid, producten en bestelgegevens.</span></div>
            <div><ShieldCheck size={20} /><strong>Jouw akkoord</strong><span>Je keurt goed voordat er iets de deur uitgaat.</span></div>
            <div><Mail size={20} /><strong>Jouw tools</strong><span>Je eigen mailbox en je webshop op Shopify, WooCommerce of bol.</span></div>
          </div>
        </section>

        <section className="h1-final">
          <SequenceMark size={64} state="happy" gear="antenna" title="" />
          <h2>Begin bij je inbox.</h2>
          <p>Probeer {support.name} 14 dagen gratis, zonder creditcard.</p>
          <div className="h1-final-actions">
            <MarketingCta href={SIGNUP}>Start 14 dagen gratis</MarketingCta>
            <MarketingCta href="/contact" variant="secondary">Plan een kennismaking</MarketingCta>
          </div>
        </section>
      </main>
      <MarketingFooter product="" tagline="AI-agents voor e-commerce ondernemers." />
    </div>
  );
}

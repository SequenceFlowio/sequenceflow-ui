import Image from "next/image";
import { Check, Mail, Package, ShieldCheck, Store } from "lucide-react";

import { DEFAULT_APP_ORIGIN } from "@/lib/brand";
import { PRODUCTS } from "@/lib/marketing/products";

import { BetaSignup } from "./BetaSignup";
import { MarketingAttribution } from "./MarketingAttribution";
import { MarketingCta } from "./MarketingCta";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";
import { SequenceMark } from "./SequenceMark";

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
            <div className="h1-tile-copy">
              <div className="h1-tile-top"><span className="h1-badge h1-badge--live">Live</span><span className="h1-kind">Klantenservice</span></div>
              <h2>{support.name}</h2>
              <p>Beantwoordt je klantmails in jouw stijl, met de bestelling en je beleid erbij. Jij keurt goed.</p>
              <div className="h1-actions">
                <MarketingCta href={SIGNUP}>Start 14 dagen gratis</MarketingCta>
                <MarketingCta href={support.href} variant="secondary">Bekijk {support.name}</MarketingCta>
              </div>
              <small>Geen creditcard nodig</small>
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
            <div className="h1-tile-top"><span className="h1-badge h1-badge--soon">Binnenkort · beta</span><span className="h1-kind">Social content</span></div>
            <h2>{content.name}</h2>
            <p>Maakt van je producten social posts in jouw merkstijl.</p>
            <div className="h1-posts" aria-hidden="true">
              {["content-post", "content-example-carousel", "content-example-ugc"].map((photo) => (
                <div key={photo}><Image src={`/media/site/${photo}.jpg`} alt="" fill sizes="140px" /></div>
              ))}
            </div>
            <BetaSignup />
          </article>
        </section>

        <section className="h1-trust" aria-label="Waarom SequenceFlow">
          <div><ShieldCheck size={18} /><span>Jij keurt goed voordat er iets de deur uitgaat</span></div>
          <div><Store size={18} /><span>Werkt met je eigen mailbox en Shopify, WooCommerce of bol</span></div>
          <div><SequenceMark size={22} gear="antenna" title="" /><span>Gebouwd in Nederland</span></div>
        </section>
      </main>
      <MarketingFooter product="" tagline="AI-agents voor e-commerce ondernemers." />
    </div>
  );
}

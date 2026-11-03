import { ArrowRight, Check, Sparkles } from "lucide-react";

import { PRODUCTS, SITE_NAV } from "@/lib/marketing/products";

import { ContentCampaign, SupportInsight, SupportWorkflow } from "./HubStoryVisuals";
import { HubProductDemo } from "./HubProductDemo";
import { MarketingAttribution } from "./MarketingAttribution";
import { MarketingCta } from "./MarketingCta";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";

import { Reveal } from "./Reveal";
import { SequenceMark } from "./SequenceMark";

/**
 * De bedrijfspagina op sequenceflow.io: algemener dan de productlandings, en
 * vooral bedoeld om e-commerce ondernemers naar het juiste product te sturen.
 */

const support = PRODUCTS.support;
const content = PRODUCTS.content;


const FAQ = [
  { question: "Welke agent past bij mij?", answer: "Krijg je veel klantvragen en wil je daar rust in, begin dan met Support One. Wil je meer verkopen via social media zonder er avonden in te steken, dan is Content One voor jou. Support One is beschikbaar; voor Content One kun je early access aanvragen." },
  { question: "Kan ik ze los van elkaar gebruiken?", answer: "Ja. Support One gebruik je zelfstandig. Content One is nog in ontwikkeling; toegang en de uiteindelijke mogelijkheden communiceren we bij de introductie." },
  { question: "Werkt het met mijn webshopplatform?", answer: "Support One ondersteunt mailboxkoppelingen en bestelcontext uit Shopify, WooCommerce en bol.com. Welke informatie beschikbaar is, hangt af van je koppelingen en rechten. Content One is in ontwikkeling." },
  { question: `Wanneer is ${content.name} beschikbaar?`, answer: `${content.name} is in ontwikkeling. Vraag early access aan, dan nemen we contact op zodra je kunt starten en denk je mee over wat er als eerste in komt.` },
];

function ProductChoice({ product }: { product: "support" | "content" }) {
  const item = PRODUCTS[product];
  return (
    <a className="hub-choice" href={item.href}>
      <span className="hub-choice-mascot"><SequenceMark size={44} gear={product === "support" ? "headset" : "camera"} state="happy" title="" /></span>
      <span><strong>{item.name}</strong><small>{product === "support" ? "Klantenservice" : "Social content"}</small></span>
      <ArrowRight size={16} />
    </a>
  );
}

export function HubLanding() {
  return (
    <div className="mk-page">
      <MarketingAttribution page="/" />
      <MarketingHeader product="" nav={SITE_NAV} cta={{ href: "#producten", label: "Ontdek de producten" }} showLogin={false} />
      <main id="main-content">
        <section className="mk-hero hub-hero">
          <div className="mk-hero-copy">
            <div className="mk-eyebrow mk-enter"><span />AI-agents voor e-commerce ondernemers</div>
            <h1 className="mk-enter mk-enter--1">
              <span className="mk-hero-title-line">Jouw webshop groeit.</span>
              <em>Jij krijgt weer ruimte.</em>
            </h1>
            <p className="mk-enter mk-enter--2">
              AI voor je klantenservice en social content. Van een klantvraag naar een passend antwoord. Van je producten naar je volgende post. Jij houdt de controle.
            </p>
            <div className="mk-hero-actions mk-enter mk-enter--3">
              <MarketingCta href="#producten">Bekijk wat je kunt uitbesteden</MarketingCta>
              <MarketingCta href="/contact" variant="secondary">Plan een kennismaking</MarketingCta>
            </div>
            <div className="mk-trust-row mk-enter mk-enter--4"><span>Voor Shopify, WooCommerce en bol</span><span>Jij houdt de controle</span><span>Gebouwd in Nederland</span></div>
          </div>

          <div className="mk-enter mk-enter--2"><HubProductDemo /></div>
        </section>

        <Reveal as="section" className="hub-products" id="producten">
          <div className="mk-section-heading hub-center-heading">
            <span>GEEF HET TERUGKERENDE WERK UIT HANDEN</span>
            <h2>Minder werk op je bord. Meer aandacht voor je winkel.</h2>
          </div>
          <div className="hub-product-grid">
            <Reveal as="article" className="hub-product">
              <SupportWorkflow />
              <div className="hub-product-body">
                <div className="hub-product-top"><span className="so-label">01 / SUPPORT ONE</span><span className="hub-status hub-status--live">Live</span></div>
                <h3>{support.name}</h3>
                <p>Een klantvraag komt binnen. Support One brengt je beleid en beschikbare bestelgegevens erbij en bereidt een antwoord voor. Jij controleert en verstuurt.</p>
                <ul>
                  <li><Check size={15} />Antwoordconcepten voor je klantvragen</li>
                  <li><Check size={15} />Bestelcontext uit je verkoopkanaal</li>
                  <li><Check size={15} />Inzicht in terugkerende vragen en knelpunten</li>
                  <li className="is-soon"><Sparkles size={15} />Voorraadinzicht en inkoopadvies met Scale</li>
                </ul>
                <div className="hub-product-actions">
                  <MarketingCta href={support.href}>Bekijk {support.name}</MarketingCta>
                  <small>14 dagen gratis, geen creditcard</small>
                </div>
              </div>
            </Reveal>

            <Reveal as="article" className="hub-product" delay={110}>
              <ContentCampaign />
              <div className="hub-product-body">
                <div className="hub-product-top"><span className="so-label">02 / CONTENT ONE</span><span className="hub-status">Early access</span></div>
                <h3>{content.name}</h3>
                <p>{content.tagline} We bouwen aan een werkplek voor posts, captions en je planning, vanuit je producten en jouw merkstem. Meld je aan voor early access en denk mee.</p>
                <ul>
                  <li><Check size={15} />Posts en carrousels vanuit je producten</li>
                  <li><Check size={15} />Captions en hooks in jouw merkstem</li>
                  <li><Check size={15} />Een contentkalender die vanzelf vol raakt</li>
                  <li><Check size={15} />Beoordeel je content voordat je publiceert</li>
                </ul>
                <div className="hub-product-actions">
                  <MarketingCta href={content.href}>Bekijk {content.name}</MarketingCta>
                  <small>In ontwikkeling</small>
                </div>
              </div>
            </Reveal>
          </div>
        </Reveal>

        <Reveal as="section" className="hs-insight-section">
          <div className="hs-editorial-copy"><span className="so-label">03 / SUPPORT ONE · VOORRAADINZICHT</span><h2>Zie wat aandacht vraagt.<br />Voordat je misgrijpt.</h2><p>Klantvragen vertellen je wat er speelt. Verkoop en voorraad laten zien wat eraan komt. Vera brengt die signalen samen, zodat je gericht kunt bijbestellen.</p><a className="hub-pain-link" href={support.href}>Ontdek voorraad & inkoopadvies <ArrowRight size={15} /></a><small>Onderdeel van Scale · beschikbare gegevens hangen af van je koppelingen</small></div>
          <SupportInsight />
        </Reveal>
        <Reveal as="section" className="hs-brand-section">
          <ContentCampaign brand />
          <div className="hs-editorial-copy"><span className="so-label">04 / CONTENT ONE · JOUW MERK</span><h2>Een ander format.<br />Nog steeds jouw merk.</h2><p>Een productpost vandaag. Een carrousel morgen. We bouwen aan content die je merk herkenbaar houdt, met ruimte om beelden, captions en planning zelf te beoordelen.</p><a className="hub-pain-link" href={content.href}>Ontdek Content One <ArrowRight size={15} /></a><small>Early access · dit voorbeeld laat de beoogde werkwijze zien</small></div>
        </Reveal>

        <Reveal as="section" className="so-feature hub-together">
          <div className="so-feature-copy">
            <span className="so-label">GEBOUWD ROND JOUW WINKEL</span>
            <h2>Jouw kennis is het begin.<br />Jouw akkoord de laatste stap.</h2>
            <p>Goede AI begint bij de juiste informatie. Je producten, je beleid en jouw manier van communiceren. Support One gebruikt die context voor antwoorden. Voor Content One bouwen we vanuit hetzelfde principe.</p>
            <span className="so-inline-proof"><Check size={18} /> Jij bepaalt wat de deur uitgaat</span>
          </div>
          <div className="hp-mascot-stage"><span className="hp-status">Voorbereid. Voor jou.</span><SequenceMark size={330} state="reading" followPointer={400} title="SequenceFlow mascotte" /></div>
        </Reveal>

        <Reveal as="section" className="hub-shops">
          <div className="mk-section-heading hub-center-heading">
            <span>GEMAAKT VOOR E-COMMERCE</span>
            <h2>Voor webshops zoals de jouwe.</h2>
            <p>Andere producten. Herkenbare vragen. Begin bij het werk dat in jouw winkel steeds terugkomt.</p>
          </div>
          <div className="hub-shop-grid">
            {[
              ["Mode & accessoires", "Zit deze trui op maat?", "Een maatvraag beantwoorden met je eigen productinformatie."],
              ["Beauty & verzorging", "Hoe gebruik ik dit serum?", "Productinformatie als basis voor een antwoord én een contentidee."],
              ["Wonen & lifestyle", "Wanneer komt mijn bestelling?", "Beschikbare bestelcontext erbij, zonder een bezorgdatum te verzinnen."],
            ].map(([label, question, detail]) => <article className="hp-usecase" key={label}><span className="so-label">{label}</span><h3>{question}</h3><p>{detail}</p></article>)}
          </div>
        </Reveal>

        <Reveal as="section" className="mk-faq">
          <div className="mk-section-heading"><span>VEELGESTELDE VRAGEN</span><h2>Waar begin je?</h2></div>
          <div>{FAQ.map((item) => <details key={item.question}><summary>{item.question}<span>+</span></summary><p>{item.answer}</p></details>)}</div>
        </Reveal>

        <Reveal as="section" className="mk-final-cta">
          <div className="mk-final-cta-content">
            <div className="mk-eyebrow"><span />JOUW NIEUWE COLLEGA&apos;S</div>
            <h2>Kies waar je begint.</h2>
            <p>Rust in je klantenservice, of een feed die vanzelf vol raakt.</p>
            <div className="hub-choices">
              <ProductChoice product="support" />
              <ProductChoice product="content" />
            </div>
          </div>
          <div className="mk-final-cta-art" aria-hidden="true"><SequenceMark className="mk-final-cta-mark" size={880} variant="outline" gear="antenna" title="" /></div>
        </Reveal>
      </main>
      <MarketingFooter product="" tagline="AI-agents voor e-commerce ondernemers." />
    </div>
  );
}

import { ArrowRight, Camera, Check, Clock3, Headphones, Inbox, LineChart, Sparkles } from "lucide-react";

import { PRODUCTS } from "@/lib/marketing/products";

import { HeroFilm } from "./HeroFilm";
import { LottieSlot } from "./LottieSlot";
import { MarketingAttribution } from "./MarketingAttribution";
import { MarketingCta } from "./MarketingCta";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";
import { PhotoSlot } from "./PhotoSlot";
import { Reveal } from "./Reveal";
import { SequenceMark } from "./SequenceMark";

/**
 * De bedrijfspagina op sequenceflow.io: algemener dan de productlandings, en
 * vooral bedoeld om e-commerce ondernemers naar het juiste product te sturen.
 */

const support = PRODUCTS.support;
const content = PRODUCTS.content;

const NAV = [
  { href: support.href, label: support.name },
  { href: content.href, label: content.name },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

// Twee per product, om en om: de bedrijfspagina blijft in balans.
const PAINS = [
  {
    icon: Inbox,
    title: "De inbox loopt over",
    description: "Waar blijft mijn pakket? Kan ik ruilen? Elke dag dezelfde vragen, en elke klant verwacht snel een goed antwoord.",
    product: support,
  },
  {
    icon: Clock3,
    title: "Content kost je je avonden",
    description: "Je weet dat je moet posten om organisch te verkopen, maar foto's, captions en een planning schieten er steeds bij in.",
    product: content,
  },
  {
    icon: LineChart,
    title: "Je ziet pas laat wat er misgaat",
    description: "Terugkerende klachten, producten die uitverkopen, vragen die op een probleem wijzen: het zit verspreid over mails en dashboards.",
    product: support,
  },
  {
    icon: Camera,
    title: "Elke post begint bij nul",
    description: "Weer een productfoto bewerken, weer een caption verzinnen. Terwijl je al prima foto's hebt die je feed kunnen vullen.",
    product: content,
  },
];

const FAQ = [
  { question: "Welke agent past bij mij?", answer: "Krijg je veel klantvragen en wil je daar rust in, begin dan met Support One. Wil je meer verkopen via social media zonder er avonden in te steken, dan is Content One voor jou. Ze werken los van elkaar, dus je kunt met één beginnen." },
  { question: "Kan ik ze los van elkaar gebruiken?", answer: "Ja. Elke agent heeft een eigen abonnement en werkt op zichzelf. Gebruik je beide, dan helpen ze elkaar straks met dezelfde kennis over je producten en je merk." },
  { question: "Werkt het met mijn webshopplatform?", answer: "Support One werkt met elke supportmailbox en haalt bestelcontext op uit bol; Shopify en WooCommerce volgen. Content One bouwen we eerst voor Shopify en WooCommerce." },
  { question: `Wanneer is ${content.name} beschikbaar?`, answer: `${content.name} is in ontwikkeling. Vraag early access aan, dan nemen we contact op zodra je kunt starten en denk je mee over wat er als eerste in komt.` },
];

function ProductChoice({ product }: { product: "support" | "content" }) {
  const item = PRODUCTS[product];
  const Icon = product === "support" ? Headphones : Camera;
  return (
    <a className="hub-choice" href={item.href}>
      <span className="hub-choice-icon"><Icon size={18} /></span>
      <span><strong>{item.name}</strong><small>{product === "support" ? "Klantenservice" : "Social content"}</small></span>
      <ArrowRight size={16} />
    </a>
  );
}

export function HubLanding() {
  return (
    <div className="mk-page">
      <MarketingAttribution page="/" />
      <MarketingHeader product="" nav={NAV} cta={{ href: "#producten", label: "Kies je agent" }} showLogin={false} />
      <main id="main-content">
        <section className="mk-hero hub-hero">
          <div className="mk-hero-copy">
            <div className="mk-eyebrow mk-enter"><span />AI-agents voor e-commerce ondernemers</div>
            <h1 className="mk-enter mk-enter--1">
              <span className="mk-hero-title-line">Twee <SequenceMark className="mk-title-mark" state="happy" followPointer={520} gear="antenna" title="" /> AI-collega&apos;s</span>
              <em>voor je webshop.</em>
            </h1>
            <p className="mk-enter mk-enter--2">
              Jij bouwt het merk. {support.name} handelt je klantenservice af en houdt je webshop in de gaten. {content.name} maakt van je producten social content die verkoopt.
            </p>
            {/* Twee gelijkwaardige keuzes: de bedrijfspagina trekt geen product voor. */}
            <div className="hub-choices mk-enter mk-enter--3">
              <ProductChoice product="support" />
              <ProductChoice product="content" />
            </div>
            <div className="mk-trust-row mk-enter mk-enter--4"><span>Voor Shopify, WooCommerce en bol</span><span>Jij houdt de controle</span><span>Gebouwd in Nederland</span></div>
          </div>

          <div className="mk-enter mk-enter--2"><HeroFilm /></div>
        </section>

        <Reveal as="section" className="hub-products" id="producten">
          <div className="mk-section-heading hub-center-heading">
            <span>KIES JE AGENT</span>
            <h2>Twee agents. Eén doel: een webshop die groeit zonder dat jij alles zelf doet.</h2>
          </div>
          <div className="hub-product-grid">
            <Reveal as="article" className="hub-product">
              <div className="hub-product-media">
                <PhotoSlot id="hub-support" />
                <LottieSlot src="/lottie/support-check.json" className="hub-product-lottie" />
              </div>
              <div className="hub-product-body">
                <div className="hub-product-top"><span className="so-label">01 / KLANTENSERVICE &amp; INZICHT</span><span className="hub-status hub-status--live">Nu beschikbaar</span></div>
                <h3>{support.name}</h3>
                <p>{support.tagline} Elke klantmail krijgt een antwoordconcept op basis van jouw beleid en je bestelgegevens. We bouwen het uit tot een agent die je hele webshop meekijkt.</p>
                <ul>
                  <li><Check size={15} />Antwoordconcepten voor elke klantmail</li>
                  <li><Check size={15} />Bestelcontext uit je verkoopkanaal</li>
                  <li><Check size={15} />Inzicht in terugkerende vragen en knelpunten</li>
                  <li className="is-soon"><Sparkles size={15} />Binnenkort: signalen over voorraad en bestellingen</li>
                </ul>
                <div className="hub-product-actions">
                  <MarketingCta href={support.href}>Bekijk {support.name}</MarketingCta>
                  <small>14 dagen gratis, geen creditcard</small>
                </div>
              </div>
            </Reveal>

            <Reveal as="article" className="hub-product" delay={110}>
              <div className="hub-product-media">
                <PhotoSlot id="hub-content" />
                <LottieSlot src="/lottie/content-stack.json" className="hub-product-lottie" />
              </div>
              <div className="hub-product-body">
                <div className="hub-product-top"><span className="so-label">02 / SOCIAL CONTENT</span><span className="hub-status">Early access</span></div>
                <h3>{content.name}</h3>
                <p>{content.tagline} Van je productcatalogus naar posts, carrousels en Reel-scripts in jouw merkstem, zodat je organisch blijft verkopen.</p>
                <ul>
                  <li><Check size={15} />Posts en carrousels vanuit je producten</li>
                  <li><Check size={15} />Captions en hooks in jouw merkstem</li>
                  <li><Check size={15} />Een contentkalender die vanzelf vol raakt</li>
                  <li><Check size={15} />Voor Instagram, TikTok en Pinterest</li>
                </ul>
                <div className="hub-product-actions">
                  <MarketingCta href={content.href}>Bekijk {content.name}</MarketingCta>
                  <small>In ontwikkeling</small>
                </div>
              </div>
            </Reveal>
          </div>
        </Reveal>

        <Reveal as="section" className="hub-pains">
          <div className="mk-section-heading">
            <span>VOOR ONDERNEMERS DIE ALLES ZELF DOEN</span>
            <h2>Je bent inkoper, marketeer, klantenservice en inpakker tegelijk.</h2>
            <p>Je webshop groeit, maar jouw dag niet mee. Daar zijn onze agents voor: ze nemen het werk over dat elke dag terugkomt, zodat jij tijd hebt voor wat alleen jij kunt.</p>
          </div>
          <div className="hub-pain-grid">
            {PAINS.map(({ icon: Icon, title, description, product }, index) => (
              <Reveal as="article" className="hub-pain" delay={index * 90} key={title}>
                <span className="hub-pain-icon"><Icon size={20} /></span>
                <h3>{title}</h3>
                <p>{description}</p>
                <a href={product.href} className="hub-pain-link">Opgelost met {product.name} <ArrowRight size={14} /></a>
              </Reveal>
            ))}
          </div>
        </Reveal>

        <Reveal as="section" className="so-feature hub-together">
          <div className="so-feature-copy">
            <span className="so-label">SAMEN STERKER</span>
            <h2>Eén webshop.<br />Twee agents die elkaar kennen.</h2>
            <p>Beide agents leren jouw producten, je merkstem en je beleid kennen. Daar bouwen we naartoe: de vragen die klanten aan {support.name} stellen, worden ideeën voor de content van {content.name}. En wat goed verkoopt, weet je support al voordat de vragen binnenkomen.</p>
            <span className="so-inline-proof"><Sparkles size={18} /> Begin met één, voeg de ander toe wanneer je wilt</span>
          </div>
          <div className="hub-together-visual">
            <LottieSlot src="/lottie/hub-flow.json" label={`Je webshop in het midden, verbonden met ${support.name} en ${content.name}`} />
            <div className="hub-together-labels" aria-hidden="true"><span>{support.name}</span><span>Je webshop</span><span>{content.name}</span></div>
          </div>
        </Reveal>

        <Reveal as="section" className="hub-shops">
          <div className="mk-section-heading hub-center-heading">
            <span>GEMAAKT VOOR E-COMMERCE</span>
            <h2>Voor webshops zoals de jouwe.</h2>
            <p>Van mode tot beauty en wonen: of je nu tien of duizend bestellingen per week verstuurt, je klanten en je feed verdienen aandacht.</p>
          </div>
          <div className="hub-shop-grid">
            {([["hub-shop-fashion", "Mode & accessoires"], ["hub-shop-beauty", "Beauty & verzorging"], ["hub-shop-home", "Wonen & lifestyle"]] as const).map(([id, label], index) => (
              <Reveal as="article" className="hub-shop" delay={index * 90} key={id}>
                <PhotoSlot id={id} sizes="(max-width: 760px) 100vw, 33vw" />
                <span>{label}</span>
              </Reveal>
            ))}
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

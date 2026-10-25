import { ArrowRight, CalendarDays, Check, Heart, MessageCircle, Package, ShieldCheck } from "lucide-react";

import { PRODUCTS } from "@/lib/marketing/products";

import { LottieSlot } from "./LottieSlot";
import { MarketingAttribution } from "./MarketingAttribution";
import { MarketingCta } from "./MarketingCta";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingHeader } from "./MarketingHeader";
import { MeetingRequest } from "./MeetingRequest";
import { PhotoSlot } from "./PhotoSlot";
import { Reveal } from "./Reveal";
import { SequenceMark } from "./SequenceMark";

/**
 * Landing van de contentgenerator. Zelfde opbouw en stijl als de Support
 * One-landing; het product is in ontwikkeling, dus de actie is early access
 * in plaats van een proefperiode.
 */

const content = PRODUCTS.content;
const support = PRODUCTS.support;
const EARLY_ACCESS = "#early-access";

const NAV = [
  { href: "#voorbeelden", label: "Voorbeelden" },
  { href: "#features", label: "Functies" },
  { href: "#werking", label: "Werking" },
  { href: support.href, label: support.name },
  { href: "/blog", label: "Blog" },
];

const WORKFLOW = [
  ["01", "Koppel je webshop", "We lezen je producten, foto's en beschrijvingen in. Daar begint elke post mee."],
  ["02", "Leg je merkstem vast", "Kies hoe je klinkt en laat een paar posts zien die je goed vindt. Daar leert Content One van."],
  ["03", "Keur je week goed", "Je krijgt een week aan content klaargezet. Jij past aan, keurt goed en plant in."],
];

const TONES = [
  { name: "Speels", text: "Deze sneaker gaat overal mee naartoe 👟 Ook naar die bruiloft waar je eigenlijk geen zin in had." },
  { name: "Zakelijk", text: "Leer van topkwaliteit, met de hand afgewerkt. Gemaakt om jaren mee te gaan." },
  { name: "Minimal", text: "Wit. Leer. Elke dag." },
];

const FAQ = [
  { question: `Wanneer kan ik ${content.name} gebruiken?`, answer: `${content.name} is in ontwikkeling. Met early access ben je er als eerste bij en denk je mee over wat er als eerste in komt. We nemen persoonlijk contact op zodra je kunt starten.` },
  { question: "Met welke webshops werkt het?", answer: "We beginnen met Shopify en WooCommerce. Je productcatalogus is de basis voor elke post, dus een koppeling met je webshop is de eerste stap." },
  { question: "Plaatst het zelf posts op mijn kanalen?", answer: "Je keurt altijd eerst goed. Daarna kun je posts inplannen voor Instagram, TikTok en Pinterest, of ze downloaden en zelf plaatsen." },
  { question: "Maakt het ook beeld, of alleen tekst?", answer: "Beide. Content One schrijft captions, hooks en Reel-scripts, en maakt nieuwe beelden van je bestaande productfoto's, zoals lifestyle-scènes en carrouselslides." },
  { question: `Werkt het samen met ${support.name}?`, answer: `Dat is het plan. Wat klanten aan ${support.name} vragen, levert de beste ideeën op voor content: vragen beantwoorden voordat ze gesteld worden. Je kunt beide ook los gebruiken.` },
];

export function ContentLanding() {
  return (
    <div className="mk-page">
      <MarketingAttribution page="/content" />
      <MarketingHeader product={content.name} homeHref="/" nav={NAV} cta={{ href: EARLY_ACCESS, label: "Vraag early access" }} showLogin={false} />
      <main id="main-content">
        <section className="mk-hero">
          <div className="mk-hero-copy">
            <div className="mk-eyebrow mk-enter"><span />AI-content voor e-commerce <b className="ct-badge">In ontwikkeling</b></div>
            <h1 className="mk-enter mk-enter--1">
              <span className="mk-hero-title-line">Je <SequenceMark className="mk-title-mark" state="happy" followPointer={520} title="" /> AI-collega</span>
              <em>voor social content.</em>
            </h1>
            <p className="mk-enter mk-enter--2">
              {content.name} maakt van je producten posts, carrousels en Reel-scripts in jouw merkstem. Zo verkoop je organisch via social media, zonder dat het je avonden kost.
            </p>
            <div className="mk-hero-actions mk-enter mk-enter--3">
              <MarketingCta href={EARLY_ACCESS}>Vraag early access</MarketingCta>
              <a className="mk-text-link" href="#voorbeelden">Bekijk een voorbeeld <span>↓</span></a>
            </div>
            <div className="mk-trust-row mk-enter mk-enter--4"><span>Vanuit je eigen productcatalogus</span><span>In jouw merkstem</span><span>Jij keurt alles goed</span></div>
          </div>

          <div className="ct-demo mk-enter mk-enter--2" id="voorbeelden">
            <div className="ct-demo-product">
              <div className="ct-demo-caption"><Package size={15} /> Uit je webshop</div>
              <PhotoSlot id="content-product" sizes="(max-width: 760px) 100vw, 360px" priority />
              <div className="ct-product-meta"><strong>Classic leather sneaker</strong><span>€ 129,00 · wit</span></div>
            </div>
            <div className="ct-demo-arrow" aria-hidden="true">
              <LottieSlot src="/lottie/pulse.json" className="ct-demo-pulse" />
              <span>{content.name}</span>
            </div>
            <div className="ct-post">
              <div className="ct-post-head"><span className="ct-avatar" /><div><strong>jouwwinkel</strong><small>Ingepland voor donderdag 19:30</small></div></div>
              <PhotoSlot id="content-post" sizes="(max-width: 760px) 100vw, 420px" priority />
              <div className="ct-post-actions" aria-hidden="true"><Heart size={18} /><MessageCircle size={18} /></div>
              <p><strong>jouwwinkel</strong> Eén paar dat bij álles past. Onze classic sneaker is terug in wit, en hij gaat sneller dan je denkt. 🤍 Link in bio.</p>
              <div className="ct-post-formats"><span className="is-active">Post</span><span>Carrousel</span><span>Reel-script</span><span>Pin</span></div>
            </div>
          </div>
          <p className="ct-demo-note">Illustratief voorbeeld. Je productfoto gaat erin, een post in jouw stijl komt eruit.</p>
        </section>

        <div className="so-story" id="features">
          <Reveal as="section" className="so-intro"><span className="mk-section-kicker">GEMAAKT VOOR WEBSHOPS</span><h2>Je producten verdienen een feed.<br /><span>Niet alleen een productpagina.</span></h2><p>Organisch verkopen via social media werkt, maar alleen als je blijft posten. {content.name} neemt het maakwerk over, zodat jij elke week content hebt die bij je merk past.</p></Reveal>

          <Reveal as="section" className="so-feature">
            <div className="so-feature-copy"><span className="so-label">01 / VAN PRODUCT NAAR POST</span><h2>Eén productfoto.<br />Een week aan content.</h2><p>Kies een product, of laat Content One kiezen wat nieuw of populair is. Je krijgt posts, carrouselslides en een Reel-script terug, met hooks die passen bij het platform.</p><a href="#voorbeelden" className="mk-text-link">Bekijk het voorbeeld <ArrowRight size={15} /></a></div>
            <div className="ct-feature-lottie"><LottieSlot src="/lottie/content-stack.json" label="Drie posts die uit één product ontstaan" /></div>
          </Reveal>

          <Reveal as="section" className="so-feature so-feature--reverse">
            <div className="so-feature-copy"><span className="so-label">02 / JOUW MERKSTEM</span><h2>Klinkt als jij.<br />Niet als een robot.</h2><p>Leg vast hoe je merk praat: speels, zakelijk of juist minimal. Content One schrijft elke caption in die stijl en leert van de posts die jij aanpast.</p></div>
            <div className="ct-tones" aria-label="Voorbeeld: dezelfde sneaker in drie merkstemmen">
              {TONES.map((tone, index) => (
                <div className={`ct-tone${index === 0 ? " is-active" : ""}`} key={tone.name}><span>{tone.name}</span><p>“{tone.text}”</p></div>
              ))}
            </div>
          </Reveal>

          <Reveal as="section" className="so-feature">
            <div className="so-feature-copy"><span className="so-label">03 / CONTENTKALENDER</span><h2>Altijd iets klaarstaan.<br />Zonder planningsstress.</h2><p>Content One vult je kalender met een mix van productposts, tips en acties. Rond feestdagen en campagnes stelt het zelf iets voor. Jij schuift, keurt goed en plant in.</p><span className="so-inline-proof"><CalendarDays size={18} /> Instagram, TikTok en Pinterest</span></div>
            <div className="so-visual"><PhotoSlot id="content-calendar" className="ct-rounded" /></div>
          </Reveal>

          <div className="so-feature-pair">
            <Reveal as="article" className="so-small-feature"><span className="so-label">04 / ELK FORMAT</span><h2>Post, carrousel, Reel<br />of pin.</h2><p>Elk platform vraagt iets anders. Content One maakt hetzelfde product passend voor elk kanaal: van een korte hook voor TikTok tot een zoekvriendelijke pin.</p><div className="ct-format-list">{["Instagram-post", "Carrousel", "Reel-script", "TikTok-hook", "Pinterest-pin", "Productverhaal"].map((format) => <span key={format}><Check size={13} />{format}</span>)}</div></Reveal>
            <Reveal as="article" className="so-small-feature" delay={100}><span className="so-label">05 / JIJ BESLIST</span><h2>Niets gaat online<br />zonder jouw akkoord.</h2><p>Content One bereidt voor, jij keurt goed. Pas een caption aan, kies een andere foto of schrap een idee. Zo blijft je feed van jou.</p><div className="so-review-bubble"><span className="so-status-dot" /> 5 posts klaar voor jouw controle<Check size={17} /></div><span className="so-inline-proof"><ShieldCheck size={18} /> Goedkeuren is de standaard</span></Reveal>
          </div>
        </div>

        <Reveal as="section" className="hub-shops ct-examples">
          <div className="mk-section-heading hub-center-heading">
            <span>ZO KAN HET ERUITZIEN</span>
            <h2>Van packshot naar scrollstopper.</h2>
            <p>Drie soorten content die Content One voor je webshop maakt.</p>
          </div>
          <div className="hub-shop-grid">
            {([["content-example-carousel", "Carrousel met hook"], ["content-example-lifestyle", "Lifestyle-post"], ["content-example-ugc", "UGC-stijl Reel"]] as const).map(([id, label], index) => (
              <Reveal as="article" className="hub-shop" delay={index * 90} key={id}>
                <PhotoSlot id={id} sizes="(max-width: 760px) 100vw, 33vw" />
                <span>{label}</span>
              </Reveal>
            ))}
          </div>
        </Reveal>

        <Reveal as="section" className="mk-workflow" id="werking">
          <div className="mk-section-heading"><span>ZO WERKT HET</span><h2>In drie stappen een gevulde feed.</h2><p>Begin met je producten en je merkstem. Daarna staat er elke week nieuwe content voor je klaar.</p></div>
          <div className="mk-workflow-grid">
            {WORKFLOW.map(([number, title, description], index) => (
              <Reveal as="article" delay={index * 90} key={number}>
                <span>{number}</span><h3>{title}</h3><p>{description}</p>
              </Reveal>
            ))}
          </div>
        </Reveal>

        <Reveal as="section" className="mk-faq">
          <div className="mk-section-heading"><span>VEELGESTELDE VRAGEN</span><h2>Voor je early access aanvraagt.</h2></div>
          <div>{FAQ.map((item) => <details key={item.question}><summary>{item.question}<span>+</span></summary><p>{item.answer}</p></details>)}</div>
        </Reveal>

        <MeetingRequest
          id="early-access"
          eyebrow="EARLY ACCESS"
          title={`Er als eerste bij met ${content.name}.`}
          intro="Plan een kort gesprek van twintig minuten. We kijken naar je webshop en je kanalen, en je krijgt als een van de eersten toegang zodra Content One klaar is."
          bullets={["Je denkt mee over wat er als eerste in komt", "We bevestigen je moment binnen één werkdag"]}
          topics={[{ id: "content", label: "Early access" }]}
          submitLabel="Vraag early access aan"
          volumeLabel="Producten in je webshop"
          volumes={["Minder dan 50", "50 tot 250", "250 tot 1.000", "Meer dan 1.000"]}
        />

        <Reveal as="section" className="mk-final-cta">
          <div className="mk-final-cta-content">
            <div className="mk-eyebrow"><span />JOUW NIEUWE CONTENTCOLLEGA</div>
            <h2>Maak kennis met {content.name}.</h2>
            <p>Social content die je producten verkoopt, in jouw merkstem.</p>
            <div className="mk-final-cta-actions">
              <MarketingCta href={EARLY_ACCESS}>Vraag early access</MarketingCta>
              <a href={support.href} className="mk-final-contact">Of bekijk {support.name}</a>
            </div>
          </div>
          <div className="mk-final-cta-art" aria-hidden="true"><SequenceMark className="mk-final-cta-mark" size={880} variant="outline" title="" /></div>
        </Reveal>
      </main>
      <MarketingFooter product={content.name} tagline="AI-content voor e-commerce, met jou aan het stuur." />
    </div>
  );
}

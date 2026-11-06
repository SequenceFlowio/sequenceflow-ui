import { CalendarDays, Check, Heart, MessageCircle, Send, Sparkles } from "lucide-react";

import { MarketingCta } from "./MarketingCta";
import { SequenceMark } from "./SequenceMark";

/**
 * Nieuw concept voor de Content One-pagina (plan §8): laat het resultaat
 * zien in plaats van stockfoto's. Eén product van een kleine beautywinkel,
 * en wat Juno daar in één keer van maakt: een post met caption, een
 * carrousel en een TikTok-hook, plus een gevulde week.
 */

const PRODUCT = { brand: "Studio Lune", name: "Glow serum", detail: "30 ml · vitamine C", price: "€24,95" };

const SLIDES = [
  { kicker: "1/3", title: "Doffe huid in de winter?", text: "Zo krijg je je glow terug in 3 stappen." },
  { kicker: "2/3", title: "Stap 2: vitamine C", text: "2 druppels, 's ochtends, vóór je dagcrème." },
  { kicker: "3/3", title: "Na 2 weken", text: "Egaler, frisser, minder vlekjes. Link in bio." },
];

const WEEK = [
  { day: "Ma", type: "Post", text: "Glow serum: zo gebruik je het" },
  { day: "Di", type: "Tip", text: "Huidverzorging in de winter" },
  { day: "Wo", type: "Carrousel", text: "Voor en na in 3 slides" },
  { day: "Do", type: "Reel", text: "Hook: \"Stop met dit te doen…\"" },
  { day: "Vr", type: "Actie", text: "Weekend: gratis verzending" },
  { day: "Za", type: "Review", text: "Klant aan het woord" },
  { day: "Zo", type: "Rust", text: "" },
];

function Bottle() {
  return (
    <svg viewBox="0 0 120 200" width="104" height="172" aria-hidden="true" className="co-bottle">
      <rect x="44" y="6" width="32" height="34" rx="6" fill="#1b1d19" />
      <rect x="50" y="40" width="20" height="14" fill="#2a2d27" />
      <rect x="22" y="54" width="76" height="134" rx="18" fill="#f3c9a8" />
      <rect x="22" y="54" width="76" height="134" rx="18" fill="url(#co-glass)" />
      <rect x="34" y="96" width="52" height="50" rx="6" fill="#fffaf4" />
      <text x="60" y="116" textAnchor="middle" fontSize="9" fontWeight="700" fill="#5a3b28">STUDIO LUNE</text>
      <text x="60" y="132" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1b1d19">Glow</text>
      <defs>
        <linearGradient id="co-glass" x1="0" x2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".35" />
          <stop offset=".4" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".12" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function ContentOneConcept() {
  return (
    <div className="co">
      <section className="co-hero">
        <div className="co-hero-copy">
          <p className="co-eyebrow"><SequenceMark size={28} gear="camera" title="" /> Content One · met Juno <b>In ontwikkeling</b></p>
          <h1>Eén productfoto erin.<br /><span>Een week aan content eruit.</span></h1>
          <p>Juno maakt van je producten posts, carrousels en video-hooks in de stijl van je merk, en zet ze klaar in je weekplanning. Jij keurt goed. Nooit meer een lege feed.</p>
          <div className="co-actions"><MarketingCta href="/content#early-access">Vraag early access</MarketingCta><a href="#co-week" className="co-link">Bekijk je week ↓</a></div>
        </div>
        <div className="co-result" aria-label="Voorbeeld: van één product naar drie soorten content">
          <article className="co-product">
            <span className="co-tag">Uit je webshop</span>
            <Bottle />
            <strong>{PRODUCT.brand} · {PRODUCT.name}</strong>
            <small>{PRODUCT.detail} · {PRODUCT.price}</small>
          </article>
          <div className="co-arrow" aria-hidden="true"><Sparkles size={18} /><span>Juno maakt</span></div>
          <div className="co-outputs">
            <article className="co-post">
              <header><span className="co-avatar">SL</span><div><strong>studiolune</strong><small>Ingepland · donderdag 19:30</small></div></header>
              <div className="co-post-visual"><Bottle /><span className="co-sticker">-15% dit weekend</span></div>
              <div className="co-post-icons" aria-hidden="true"><Heart size={16} /><MessageCircle size={16} /><Send size={16} /></div>
              <p><b>studiolune</b> Winterhuid die er dof uitziet? 2 druppels Glow serum in de ochtend en je huid krijgt z&apos;n frisheid terug ✨ Vitamine C, geen parfum, geschikt voor de gevoelige huid. Dit weekend 15% korting.</p>
              <p className="co-hashtags">#huidverzorging #vitaminec #glowserum</p>
            </article>
            <div className="co-side">
              <article className="co-carousel" aria-label="Carrousel van drie slides">
                <span className="co-label">Carrousel</span>
                <div className="co-slides">
                  {SLIDES.map((slide) => <div key={slide.kicker}><small>{slide.kicker}</small><strong>{slide.title}</strong><p>{slide.text}</p></div>)}
                </div>
              </article>
              <article className="co-hook">
                <span className="co-label">TikTok-hook</span>
                <p>&ldquo;Stop met dure crèmes kopen als je huid in de winter dof is. Doe dít eerst…&rdquo;</p>
                <small>Script · 18 seconden · 4 shots</small>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section className="co-week" id="co-week">
        <div className="co-week-head">
          <SequenceMark size={64} state="happy" gear="camera" title="Juno" />
          <div>
            <p className="co-eyebrow">Je week staat klaar</p>
            <h2>Zes dagen gevuld. Jij hoeft alleen goed te keuren.</h2>
            <p>Juno plant een mix van productposts, tips, acties en reviews, rond je voorraad en de feestdagen. Schuif iets naar een andere dag of laat het opnieuw maken.</p>
          </div>
        </div>
        <ol className="co-calendar">
          {WEEK.map((item) => (
            <li key={item.day} className={item.text ? "" : "is-empty"}>
              <span className="co-day">{item.day}</span>
              {item.text ? <><b>{item.type}</b><p>{item.text}</p><small><Check size={12} /> Klaar voor controle</small></> : <p className="co-rest">Geen post</p>}
            </li>
          ))}
        </ol>
        <p className="co-proof"><CalendarDays size={16} /> Instagram, TikTok en Pinterest · in je eigen merkstem · niets gaat online zonder jouw akkoord</p>
      </section>
    </div>
  );
}

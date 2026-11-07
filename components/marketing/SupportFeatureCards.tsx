"use client";

import { ArrowDown, ArrowLeft, ArrowRight, BarChart3, Check, FileText, Mail, Package, Plus, ShieldCheck, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { PRICING_V2_ON } from "@/lib/planCatalog";

import { SequenceMark } from "./SequenceMark";
import { useReducedMotion } from "./useReducedMotion";

/**
 * De functies van Support One als kaarten. Op de kaart staat alleen de kern;
 * wie meer wil weten, klikt en de kaart groeit uit tot een venster met de
 * uitleg en een groter voorbeeld. De animatie is een FLIP: het venster start
 * op de plek en maat van de kaart en schuift dan naar het midden. Sluiten
 * gaat dezelfde weg terug.
 */

const AUTOSEND_PLANS = PRICING_V2_ON ? "elk betaald pakket" : "Growth en Scale";

type Feature = {
  id: string;
  icon: typeof Mail;
  kicker: string;
  title: string;
  line: string;
  body: string;
  facts: string[];
  tone?: "lime";
};

const FEATURES: Feature[] = [
  {
    id: "bestelling",
    icon: Package,
    kicker: "Bestelcontext",
    title: "De bestelling er al bij.",
    line: "Bestel- en verzendgegevens uit je webshop, direct naast de vraag.",
    body: "Koppel je verkoopkanaal en Support One zoekt bij een klantvraag de bijbehorende bestelling op: status, vervoerder en verzendgegevens. Die gebruikt het in het concept, zodat jij niet meer in je webshop hoeft te zoeken.",
    facts: ["Voor bol werkt dit al. Shopify draait als eerste pilot, WooCommerce volgt.", "Zonder koppeling verzint Support One geen bestelstatus.", "De webshopkoppeling is optioneel en staat los van je mailbox."],
  },
  {
    id: "kennis",
    icon: FileText,
    kicker: "Jouw kennis",
    title: "Jouw beleid in elk antwoord.",
    line: "Retourbeleid, verzendinfo en productkennis als bron.",
    body: "Voeg je retourbeleid, verzendinformatie, veelgestelde vragen en productkennis toe. Support One gebruikt de passages die bij de vraag passen, zodat elk concept klopt met wat jij je klanten belooft.",
    facts: ["Jouw voorwaarden zijn leidend, geen algemene AI-aannames.", "Je trial bevat 10 kennisdocumenten.", "Pas je beleid aan, dan gebruiken nieuwe concepten de nieuwe versie."],
  },
  {
    id: "controle",
    icon: ShieldCheck,
    kicker: "Jij beslist",
    title: "Niets gaat weg zonder jou.",
    line: "Lees het concept, pas het aan en verstuur.",
    body: "Support One bereidt voor, jij beslist. Je begint altijd met menselijke goedkeuring: lees het concept, pas het aan of neem de vraag zelf over. Pas als je het vertrouwt, kun je bepaalde antwoorden automatisch laten versturen.",
    facts: [`Automatisch versturen is optioneel en zit in ${AUTOSEND_PLANS}.`, "Je kiest zelf hoe zeker Support One moet zijn en wanneer er verstuurd wordt.", "Twijfelt Support One, dan blijft het antwoord bij jou ter beoordeling."],
    tone: "lime",
  },
  {
    id: "stijl",
    icon: Sparkles,
    kicker: "Antwoordstijl",
    title: "Leert van je correcties.",
    line: "Van jouw aanpassing naar een vaste afspraak.",
    body: "Pas je een concept aan, dan kan Support One daar een afspraak van voorstellen, zoals ‘spreek klanten aan met hun voornaam’. Zo lijkt elk volgend concept meer op hoe jij zelf schrijft.",
    facts: ["Jij bepaalt welke afspraken actief worden.", "Voorstellen komen uit aanpassingen die je echt hebt gemaakt."],
  },
  {
    id: "mailbox",
    icon: Mail,
    kicker: "Je eigen mailbox",
    title: "Geen nieuwe helpdesk.",
    line: "Werkt met het supportadres dat je al hebt.",
    body: "Klantvragen komen binnen in de mailbox die je al gebruikt. Support One zet er een concept bij klaar en verstuurt vanaf je eigen adres. Of je nu op bol, Shopify of WooCommerce verkoopt.",
    facts: ["Ontvangen via forwarding of IMAP, versturen via SMTP.", "Presets en verbindingstests voor de bekende mailproviders.", "Bij Gmail kan een appwachtwoord nodig zijn."],
  },
  {
    id: "inzichten",
    icon: BarChart3,
    kicker: "Inzichten",
    title: "Zie wat er speelt.",
    line: "Welke vragen terugkomen en waar het knelt.",
    body: "Bekijk volume, onderwerpen en knelpunten in je support. Zo zie je welke vragen steeds terugkomen en waar duidelijkere informatie op je site klanten al vooraf helpt.",
    facts: ["Verdeling van klantvragen per onderwerp.", "Terugkerende knelpunten in één overzicht."],
  },
];

/** Klein voorbeeld op de kaart zelf. */
function MiniVisual({ id }: { id: string }) {
  switch (id) {
    case "bestelling": return <span className="s1-mini s1-mini--chip"><Package size={13} /> #4521 · onderweg</span>;
    case "kennis": return <span className="s1-mini s1-mini--doc">Retour binnen <mark>30 dagen</mark></span>;
    case "controle": return <span className="s1-mini s1-mini--approve"><Check size={13} strokeWidth={3} /> Goedkeuren</span>;
    case "stijl": return <span className="s1-mini s1-mini--doc"><s>Geachte klant,</s> Hoi Sanne,</span>;
    case "mailbox": return <span className="s1-mini s1-mini--chip"><Mail size={13} /> support@jouwwinkel.nl</span>;
    default: return <span className="s1-mini s1-mini--bars" aria-hidden><i style={{ height: "80%" }} /><i style={{ height: "55%" }} /><i style={{ height: "34%" }} /><i style={{ height: "20%" }} /></span>;
  }
}

function Reply({ text }: { text: string }) {
  return <div className="h1-card h1-card--reply"><SequenceMark size={30} gear="headset" title="" /><div><strong>Antwoordconcept</strong><span>{text}</span></div></div>;
}

/** Het grote voorbeeld in het venster. */
function BigVisual({ id }: { id: string }) {
  switch (id) {
    case "bestelling":
      return <>
        <div className="h1-card"><Mail size={16} /><div><strong>Jan · klantvraag</strong><span>Waar blijft mijn bestelling?</span></div></div>
        <div className="s1-order"><div className="s1-order-top"><Package size={18} /><strong>Bestelling #4521</strong><em>Onderweg</em></div><div className="s1-track"><i className="is-done" /><b /><i className="is-done" /><b /><i /></div><div className="s1-track-labels"><span>Besteld</span><span>Verzonden</span><span>Bezorgd</span></div><small>Vervoerder <strong>PostNL</strong></small></div>
        <Reply text="Hoi Jan, je bestelling #4521 is verzonden en onderweg met PostNL. Via de track & trace zie je waar je pakket nu is." />
      </>;
    case "kennis":
      return <>
        <div className="s1-doc"><div className="s1-order-top"><FileText size={18} /><strong>Retourbeleid</strong><em>Jouw document</em></div><i /><i /><p>Je kunt je retour binnen <mark>30 dagen na ontvangst</mark> aanmelden.</p><i /></div>
        <div className="s1-arrow"><ArrowDown size={16} /> Gebruikt als bron</div>
        <Reply text="Hoi Sanne, volgens ons retourbeleid kun je je retour binnen 30 dagen na ontvangst aanmelden." />
      </>;
    case "controle":
      return <>
        <Reply text="Hoi Alex, de hoes kun je op 30 °C wassen. De kern van het kussen mag niet in de wasmachine." />
        <div className="s1-actions"><span>Aanpassen</span><span>Zelf overnemen</span><span className="is-primary"><Check size={14} strokeWidth={3} /> Goedkeuren</span></div>
        <div className="s1-toggle"><span>Automatisch versturen</span><em><i /></em><small>Uit · jij keurt alles goed</small></div>
      </>;
    case "stijl":
      return <>
        <div className="h1-card"><Sparkles size={16} /><div><strong>Jouw aanpassing</strong><span><s>Geachte klant,</s> Hoi Sanne,</span></div></div>
        <div className="s1-arrow"><ArrowDown size={16} /> Voorstel van Support One</div>
        <div className="s1-rule"><FileText size={17} /><span>Spreek klanten aan met hun voornaam.</span><em>Ter beoordeling</em></div>
        <div className="s1-actions"><span>Negeren</span><span className="is-primary"><Check size={14} strokeWidth={3} /> Afspraak activeren</span></div>
      </>;
    case "mailbox":
      return <div className="s1-route">
        <div className="h1-card"><Mail size={16} /><div><strong>Jouw mailbox</strong><span>Klantvraag komt binnen</span></div></div>
        <div className="s1-arrow"><ArrowDown size={16} /></div>
        <div className="h1-card"><SequenceMark size={26} gear="headset" title="" /><div><strong>Support One</strong><span>Concept klaar ter controle</span></div></div>
        <div className="s1-arrow"><ArrowDown size={16} /></div>
        <div className="h1-ready"><Check size={15} strokeWidth={3} /> Verstuurd vanaf support@jouwwinkel.nl</div>
      </div>;
    default:
      return <div className="s1-chart">
        <strong>Waar gaan de vragen over?</strong><small>Illustratieve verdeling</small>
        {[["Bezorging", 82], ["Retouren", 54], ["Productinformatie", 33], ["Overig", 18]].map(([name, width], index) => (
          <div className="s1-chart-row" key={name}><span>{name}</span><div><i style={{ width: `${width}%`, animationDelay: `${380 + index * 90}ms` }} /></div></div>
        ))}
      </div>;
  }
}

/** Verschuiving en schaal die het venster precies over de kaart leggen. */
function morph(from: DOMRect, to: DOMRect) {
  const sx = from.width / to.width;
  const sy = from.height / to.height;
  return {
    transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${sx}, ${sy})`,
    // De ronding schaalt mee; terugrekenen houdt de hoeken van de kaart gelijk.
    borderRadius: `${22 / sx}px / ${22 / sy}px`,
  };
}

const FOCUSABLE = "button, a[href], input, [tabindex]:not([tabindex='-1'])";

export function SupportFeatureCards() {
  const [open, setOpen] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opening = useRef(false);
  const closing = useRef(false);
  const returnFocus = useRef<number | null>(null);
  const isOpen = open !== null;

  // Scrollen op de pagina uit zolang het venster open is. In een layout-effect,
  // zodat de scrollbalk al weg is voordat de kaart wordt opgemeten.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const root = document.documentElement;
    const gutter = window.innerWidth - root.clientWidth;
    const previous = { overflow: root.style.overflow, paddingRight: root.style.paddingRight };
    root.style.overflow = "hidden";
    if (gutter > 0) root.style.paddingRight = `${gutter}px`;
    return () => { root.style.overflow = previous.overflow; root.style.paddingRight = previous.paddingRight; };
  }, [isOpen]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (open === null && returnFocus.current !== null) {
      // Pas na het renderen: zolang de kaart nog verborgen is, pakt hij geen focus.
      triggerRefs.current[returnFocus.current]?.focus({ preventScroll: true });
      returnFocus.current = null;
    }
    if (open === null || !panel) return;
    const items = panel.querySelectorAll<HTMLElement>("[data-s1-in]");
    const stagger = (delay: number) => items.forEach((item, index) => item.animate(
      [{ opacity: 0, transform: "translateY(18px)" }, { opacity: 1, transform: "none" }],
      { duration: 460, delay: delay + index * 55, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" },
    ));

    if (!opening.current) {
      // Wisselen met vorige/volgende: alleen de inhoud komt opnieuw binnen.
      if (!reduced) stagger(0);
      return;
    }
    opening.current = false;
    closeRef.current?.focus({ preventScroll: true });
    backdropRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, easing: "ease-out" });
    const card = cardRefs.current[open];
    if (reduced || !card) {
      panel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180 });
      return;
    }
    const start = morph(card.getBoundingClientRect(), panel.getBoundingClientRect());
    panel.animate([start, { transform: "none", borderRadius: "28px" }], { duration: 640, easing: "cubic-bezier(.16,1,.3,1)" });
    stagger(230);
  }, [open, reduced]);

  const show = (index: number) => {
    opening.current = true;
    setOpen(index);
  };

  const close = useCallback(() => {
    if (open === null || closing.current) return;
    const index = open;
    const panel = panelRef.current;
    const card = cardRefs.current[index];
    const finish = () => {
      closing.current = false;
      returnFocus.current = index;
      setOpen(null);
    };
    if (!panel || !card || reduced) { finish(); return; }
    closing.current = true;
    panel.querySelectorAll<HTMLElement>("[data-s1-in], .s1-panel-close").forEach((item) => item.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: "forwards" }));
    const end = morph(card.getBoundingClientRect(), panel.getBoundingClientRect());
    const options = { duration: 460, delay: 90, easing: "cubic-bezier(.6,0,.2,1)", fill: "forwards" as const };
    backdropRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], options);
    panel.animate([{ transform: "none", borderRadius: "28px" }, end], options).finished.then(finish, finish);
  }, [open, reduced]);

  const step = useCallback((delta: number) => {
    setOpen((current) => current === null ? current : (current + delta + FEATURES.length) % FEATURES.length);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      else if (event.key === "ArrowRight") step(1);
      else if (event.key === "ArrowLeft") step(-1);
      else if (event.key === "Tab" && panelRef.current) {
        // Focus binnen het venster houden.
        const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close, step]);

  const feature = open === null ? null : FEATURES[open];

  return (
    <>
      <div className="s1-grid">
        {FEATURES.map((item, index) => {
          const Icon = item.icon;
          return (
            <article
              key={item.id}
              ref={(node) => { cardRefs.current[index] = node; }}
              className={`s1-card${item.tone ? ` s1-card--${item.tone}` : ""}`}
              style={open === index ? { visibility: "hidden" } : undefined}
            >
              <button
                type="button"
                ref={(node) => { triggerRefs.current[index] = node; }}
                className="s1-card-hit"
                aria-haspopup="dialog"
                aria-label={`${item.title} Meer uitleg`}
                onClick={() => show(index)}
              />
              <div className="s1-card-top"><span className="s1-card-icon"><Icon size={19} /></span><span className="s1-card-kicker">0{index + 1} / {item.kicker}</span></div>
              <MiniVisual id={item.id} />
              <h3>{item.title}</h3>
              <p>{item.line}</p>
              <span className="s1-card-more">Meer uitleg <span className="s1-plus"><Plus size={15} strokeWidth={2.6} /></span></span>
            </article>
          );
        })}
      </div>

      {feature && open !== null && (
        <div className="s1-modal">
          <div className="s1-backdrop" ref={backdropRef} onClick={close} aria-hidden />
          <div ref={panelRef} className={`s1-panel${feature.tone ? ` s1-panel--${feature.tone}` : ""}`} role="dialog" aria-modal="true" aria-labelledby="s1-dialog-title">
            <button type="button" ref={closeRef} className="s1-panel-close" onClick={close} aria-label="Sluiten"><X size={18} /></button>
            <div className="s1-panel-copy">
              <span className="s1-card-kicker" data-s1-in>0{open + 1} / {feature.kicker}</span>
              <h3 id="s1-dialog-title" data-s1-in>{feature.title}</h3>
              <p data-s1-in>{feature.body}</p>
              <ul data-s1-in>{feature.facts.map((fact) => <li key={fact}><Check size={15} strokeWidth={3} />{fact}</li>)}</ul>
              <div className="s1-panel-nav" data-s1-in>
                <button type="button" onClick={() => step(-1)} aria-label="Vorige functie"><ArrowLeft size={16} /></button>
                <span>{open + 1} / {FEATURES.length}</span>
                <button type="button" onClick={() => step(1)} aria-label="Volgende functie"><ArrowRight size={16} /></button>
              </div>
            </div>
            <div className="s1-panel-visual" data-s1-in key={feature.id}><BigVisual id={feature.id} /></div>
          </div>
        </div>
      )}
    </>
  );
}

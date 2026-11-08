"use client";

import { AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, BarChart3, Bell, CalendarClock, Check, ClipboardList, FileText, Mail, MessageSquare, Package, PackageOpen, Plus, ShieldCheck, Sparkles, Truck, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useId, useRef, useState } from "react";

import { PRICING_V2_ON } from "@/lib/planCatalog";

import { SequenceMark } from "./SequenceMark";
import { useReducedMotion } from "./useReducedMotion";

/**
 * De functies van Support One als kaarten. Op de kaart staat alleen de kern;
 * wie meer wil weten, klikt en de kaart groeit uit tot een venster met de
 * uitleg en een groter voorbeeld. De animatie is een FLIP: het venster start
 * op de plek en maat van de kaart en schuift dan naar het midden. Sluiten
 * gaat dezelfde weg terug.
 *
 * Een schakelaar kiest de agent: Seffy (klantmails) of Otis (voorraad en
 * inkoop). Een link naar #otis of #seffy zet hem ook om.
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
  tone?: "lime" | "blue";
};

const SEFFY: Feature[] = [
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

// Alleen wat Otis in lib/inventory echt doet: rekenen per variant, klantvragen
// per variant, wachtlijst, meldingsregels, weekmail en de concept-inkooporder.
const OTIS: Feature[] = [
  {
    id: "opraken",
    icon: PackageOpen,
    kicker: "Inkoopadvies",
    title: "Ziet wat opraakt.",
    line: "Per maat en kleur, in dagen in plaats van stuks.",
    body: "Otis kijkt per variant naar je verkoop, je huidige voorraad en de levertijd van je leverancier. Zo zie je wanneer iets op is en hoeveel je moet bijbestellen om het niet te laten opraken. Seizoensproducten herkent hij uit je verkoop, of je stelt de maanden zelf in.",
    facts: ["Elk getal is uitgerekend, niet door AI geraden.", "Levertijd per leverancier telt mee.", "Werkt met je gekoppelde verkoopkanaal, of met verkoopcijfers die je als CSV importeert."],
  },
  {
    id: "vragen",
    icon: MessageSquare,
    kicker: "Samen met Seffy",
    title: "Hoort wat klanten vragen.",
    line: "Welke maat of kleur klanten noemen in je inbox.",
    body: "Otis telt in je supportinbox naar welke varianten klanten vragen: of iets weer binnenkomt, hoe het valt, de kwaliteit. Zo zie je vraag naar een product dat uitverkocht is. Klanten die wachten tot iets terug is, zet hij op een wachtlijst.",
    facts: ["Alleen aantallen, er worden geen klantteksten bewaard.", "Is het weer binnen, dan staat er een mail voor de wachtlijst klaar.", "Die mail gaat pas weg als jij bevestigt."],
  },
  {
    id: "inkooporder",
    icon: ClipboardList,
    kicker: "Inkooporder",
    title: "Zet je bestelling klaar.",
    line: "Vraag het in de chat, jij keurt goed.",
    body: "Vraag Otis gewoon: “wat moet ik deze week bijbestellen?” Hij antwoordt met cijfers uit je eigen winkel en zet een concept-inkooporder klaar. Wil Otis iets aanpassen, dan krijg je eerst een voorstel.",
    facts: ["Niets verandert zonder jouw bevestiging.", "Elk getal in een antwoord komt uit je eigen gegevens.", "Jij beslist wat er met de order gebeurt."],
    tone: "blue",
  },
  {
    id: "meldingen",
    icon: Bell,
    kicker: "Meldingen",
    title: "Meldt het op tijd.",
    line: "Jij kiest de regels, Otis seint je in.",
    body: "Otis meldt zich als er iets speelt: iets is uitverkocht terwijl klanten erom vragen, de verkoop schiet omhoog, een levering is te laat of een seizoen komt eraan. Je kiest zelf welke meldingen je wilt en vanaf wanneer.",
    facts: ["Nieuwe meldingen krijg je hoogstens één keer per dag per mail.", "Elke week een inkoopadvies in je mailbox.", "Dezelfde melding krijg je niet elke dag opnieuw."],
  },
];

// De Engelse versie voor /support-one/en: dezelfde kaarten, dezelfde volgorde.
const AUTOSEND_PLANS_EN = PRICING_V2_ON ? "every paid plan" : "Growth and Scale";

const SEFFY_EN: Feature[] = [
  { ...SEFFY[0], kicker: "Order context", title: "The order, already there.", line: "Order and shipping details from your store, right next to the question.",
    body: "Connect your sales channel and Support One looks up the matching order for each customer question: status, carrier and shipping details. It uses them in the draft, so you no longer have to dig through your store.",
    facts: ["Already works for bol. Shopify is our first pilot, WooCommerce follows.", "Without a connection, Support One never makes up an order status.", "The store connection is optional and separate from your mailbox."] },
  { ...SEFFY[1], kicker: "Your knowledge", title: "Your policy in every reply.", line: "Return policy, shipping info and product knowledge as the source.",
    body: "Add your return policy, shipping information, FAQs and product knowledge. Support One uses the passages that fit the question, so every draft matches what you promise your customers.",
    facts: ["Your terms lead, not generic AI assumptions.", "Your trial includes 10 knowledge documents.", "Update your policy and new drafts use the new version."] },
  { ...SEFFY[2], kicker: "You decide", title: "Nothing goes out without you.", line: "Read the draft, edit it and send.",
    body: "Support One prepares, you decide. You always start with human approval: read the draft, edit it or take the question over yourself. Only once you trust it can you let certain replies go out automatically.",
    facts: [`Auto-send is optional and included in ${AUTOSEND_PLANS_EN}.`, "You choose how confident Support One must be and when it sends.", "If Support One is unsure, the reply stays with you for review."] },
  { ...SEFFY[3], kicker: "Reply style", title: "Learns from your edits.", line: "From your correction to a standing rule.",
    body: "When you edit a draft, Support One can suggest a rule from it, like ‘address customers by their first name’. Every next draft sounds more like you.",
    facts: ["You decide which rules become active.", "Suggestions come from edits you actually made."] },
  { ...SEFFY[4], kicker: "Your own mailbox", title: "No new helpdesk.", line: "Works with the support address you already have.",
    body: "Customer questions arrive in the mailbox you already use. Support One prepares a draft and sends from your own address. Whether you sell on bol, Shopify or WooCommerce.",
    facts: ["Receive via forwarding or IMAP, send via SMTP.", "Presets and connection tests for common mail providers.", "Gmail may need an app password."] },
  { ...SEFFY[5], kicker: "Insights", title: "See what's going on.", line: "Which questions keep coming back, and where it hurts.",
    body: "See volume, topics and pain points in your support. Spot the questions that keep returning, and where clearer information on your site helps customers upfront.",
    facts: ["Customer questions split by topic.", "Recurring pain points in one overview."] },
];

const OTIS_EN: Feature[] = [
  { ...OTIS[0], kicker: "Buying advice", title: "Sees what's running out.", line: "Per size and colour, in days instead of units.",
    body: "Otis looks at sales per variant, your current stock and your supplier's lead time. You see when something runs out and how much to reorder before it does. Seasonal products are detected from your sales, or you set the months yourself.",
    facts: ["Every number is calculated, not guessed by AI.", "Lead time per supplier is taken into account.", "Works with your connected sales channel, or with sales figures you import as CSV."] },
  { ...OTIS[1], kicker: "Together with Seffy", title: "Hears what customers ask.", line: "Which size or colour customers mention in your inbox.",
    body: "Otis counts which variants customers ask about in your support inbox: whether something is back in stock, how it fits, the quality. You see demand for products that are sold out. Customers waiting for a restock go on a waitlist.",
    facts: ["Counts only, no customer text is stored.", "Back in stock? A waitlist email is ready to go.", "That email only goes out once you confirm."] },
  { ...OTIS[2], kicker: "Purchase order", title: "Prepares your order.", line: "Ask in the chat, you approve.",
    body: "Just ask Otis: “what should I reorder this week?” He answers with numbers from your own store and prepares a draft purchase order. If Otis wants to change something, you get a proposal first.",
    facts: ["Nothing changes without your confirmation.", "Every number in an answer comes from your own data.", "You decide what happens with the order."] },
  { ...OTIS[3], kicker: "Alerts", title: "Tells you in time.", line: "You set the rules, Otis gives you a heads-up.",
    body: "Otis speaks up when something needs attention: an item sold out while customers ask for it, a sales spike, a late delivery or a season coming up. You choose which alerts you want and from when.",
    facts: ["New alerts reach you by email at most once a day.", "A weekly buying advice in your inbox.", "You don't get the same alert every day."] },
];

const AGENTS_NL = {
  seffy: { name: "Seffy", gear: "headset" as const, title: "Wat Seffy voor je inbox doet.", kicker: "WAT SEFFY DOET", features: SEFFY },
  otis: { name: "Otis", gear: "analyst" as const, title: "Wat Otis met je voorraad doet.", kicker: "WAT OTIS DOET", features: OTIS },
};
const AGENTS_EN: typeof AGENTS_NL = {
  seffy: { ...AGENTS_NL.seffy, title: "What Seffy does for your inbox.", kicker: "WHAT SEFFY DOES", features: SEFFY_EN },
  otis: { ...AGENTS_NL.otis, title: "What Otis does with your inventory.", kicker: "WHAT OTIS DOES", features: OTIS_EN },
};
type AgentId = keyof typeof AGENTS_NL;

/** Klein voorbeeld op de kaart zelf. */
function MiniVisual({ id, en }: { id: string; en: boolean }) {
  switch (id) {
    case "bestelling": return <span className="s1-mini s1-mini--chip"><Package size={13} /> #4521 · {en ? "in transit" : "onderweg"}</span>;
    case "kennis": return <span className="s1-mini s1-mini--doc">{en ? "Returns within" : "Retour binnen"} <mark>{en ? "30 days" : "30 dagen"}</mark></span>;
    case "controle": return <span className="s1-mini s1-mini--approve"><Check size={13} strokeWidth={3} /> {en ? "Approve" : "Goedkeuren"}</span>;
    case "stijl": return <span className="s1-mini s1-mini--doc">{en ? <><s>Dear customer,</s> Hi Sanne,</> : <><s>Geachte klant,</s> Hoi Sanne,</>}</span>;
    case "mailbox": return <span className="s1-mini s1-mini--chip"><Mail size={13} /> {en ? "support@yourstore.com" : "support@jouwwinkel.nl"}</span>;
    case "opraken": return <span className="s1-mini s1-mini--chip"><PackageOpen size={13} /> {en ? "Shirt M · ~6 days left" : "Overhemd M · nog 6 dagen"}</span>;
    case "vragen": return <span className="s1-mini s1-mini--doc">{en ? "“Is the 41 back in stock?”" : "“Is de 41 weer binnen?”"} <mark>5×</mark></span>;
    case "inkooporder": return <span className="s1-mini s1-mini--approve"><ClipboardList size={13} /> {en ? "3 variants · confirm" : "3 varianten · bevestigen"}</span>;
    case "meldingen": return <span className="s1-mini s1-mini--chip"><Bell size={13} /> {en ? "Delivery 3 days late" : "Levering 3 dagen te laat"}</span>;
    default: return <span className="s1-mini s1-mini--bars" aria-hidden><i style={{ height: "80%" }} /><i style={{ height: "55%" }} /><i style={{ height: "34%" }} /><i style={{ height: "20%" }} /></span>;
  }
}

function Reply({ text, otis = false, en }: { text: string; otis?: boolean; en: boolean }) {
  return <div className="h1-card h1-card--reply"><SequenceMark size={30} gear={otis ? "analyst" : "headset"} title="" /><div><strong>{otis ? "Otis" : en ? "Reply draft" : "Antwoordconcept"}</strong><span>{text}</span></div></div>;
}

/** Het grote voorbeeld in het venster. */
function BigVisual({ id, en }: { id: string; en: boolean }) {
  const t = (nl: string, english: string) => en ? english : nl;
  switch (id) {
    case "bestelling":
      return <>
        <div className="h1-card"><Mail size={16} /><div><strong>{t("Jan · klantvraag", "Jan · customer")}</strong><span>{t("Waar blijft mijn bestelling?", "Where is my order?")}</span></div></div>
        <div className="s1-order"><div className="s1-order-top"><Package size={18} /><strong>{t("Bestelling", "Order")} #4521</strong><em>{t("Onderweg", "In transit")}</em></div><div className="s1-track"><i className="is-done" /><b /><i className="is-done" /><b /><i /></div><div className="s1-track-labels"><span>{t("Besteld", "Ordered")}</span><span>{t("Verzonden", "Shipped")}</span><span>{t("Bezorgd", "Delivered")}</span></div><small>{t("Vervoerder", "Carrier")} <strong>PostNL</strong></small></div>
        <Reply en={en} text={t("Hoi Jan, je bestelling #4521 is verzonden en onderweg met PostNL. Via de track & trace zie je waar je pakket nu is.", "Hi Jan, your order #4521 has shipped and is on its way with PostNL. Your tracking link shows where your parcel is right now.")} />
      </>;
    case "kennis":
      return <>
        <div className="s1-doc"><div className="s1-order-top"><FileText size={18} /><strong>{t("Retourbeleid", "Return policy")}</strong><em>{t("Jouw document", "Your document")}</em></div><i /><i /><p>{en ? <>You can register a return within <mark>30 days of receipt</mark>.</> : <>Je kunt je retour binnen <mark>30 dagen na ontvangst</mark> aanmelden.</>}</p><i /></div>
        <div className="s1-arrow"><ArrowDown size={16} /> {t("Gebruikt als bron", "Used as the source")}</div>
        <Reply en={en} text={t("Hoi Sanne, volgens ons retourbeleid kun je je retour binnen 30 dagen na ontvangst aanmelden.", "Hi Sanne, under our return policy you can register a return within 30 days of receipt.")} />
      </>;
    case "controle":
      return <>
        <Reply en={en} text={t("Hoi Alex, de hoes kun je op 30 °C wassen. De kern van het kussen mag niet in de wasmachine.", "Hi Alex, the cover can be washed at 30 °C. The pillow insert itself can't go in the washing machine.")} />
        <div className="s1-actions"><span>{t("Aanpassen", "Edit")}</span><span>{t("Zelf overnemen", "Take over")}</span><span className="is-primary"><Check size={14} strokeWidth={3} /> {t("Goedkeuren", "Approve")}</span></div>
        <div className="s1-toggle"><span>{t("Automatisch versturen", "Auto-send")}</span><em><i /></em><small>{t("Uit · jij keurt alles goed", "Off · you approve everything")}</small></div>
      </>;
    case "stijl":
      return <>
        <div className="h1-card"><Sparkles size={16} /><div><strong>{t("Jouw aanpassing", "Your edit")}</strong><span>{en ? <><s>Dear customer,</s> Hi Sanne,</> : <><s>Geachte klant,</s> Hoi Sanne,</>}</span></div></div>
        <div className="s1-arrow"><ArrowDown size={16} /> {t("Voorstel van Support One", "Suggested by Support One")}</div>
        <div className="s1-rule"><FileText size={17} /><span>{t("Spreek klanten aan met hun voornaam.", "Address customers by their first name.")}</span><em>{t("Ter beoordeling", "For review")}</em></div>
        <div className="s1-actions"><span>{t("Negeren", "Ignore")}</span><span className="is-primary"><Check size={14} strokeWidth={3} /> {t("Afspraak activeren", "Activate rule")}</span></div>
      </>;
    case "mailbox":
      return <div className="s1-route">
        <div className="h1-card"><Mail size={16} /><div><strong>{t("Jouw mailbox", "Your mailbox")}</strong><span>{t("Klantvraag komt binnen", "A customer question arrives")}</span></div></div>
        <div className="s1-arrow"><ArrowDown size={16} /></div>
        <div className="h1-card"><SequenceMark size={26} gear="headset" title="" /><div><strong>Support One</strong><span>{t("Concept klaar ter controle", "Draft ready for review")}</span></div></div>
        <div className="s1-arrow"><ArrowDown size={16} /></div>
        <div className="h1-ready"><Check size={15} strokeWidth={3} /> {t("Verstuurd vanaf support@jouwwinkel.nl", "Sent from support@yourstore.com")}</div>
      </div>;
    case "opraken":
      return <>
        <div className="s1-order"><div className="s1-order-top"><PackageOpen size={18} /><strong>{t("Linnen overhemd · M", "Linen shirt · M")}</strong><em>{t("Bijbestellen", "Reorder")}</em></div>
          <div className="s1-days"><span>{t("Voorraad", "Stock")}</span><div><i style={{ width: "22%" }} /></div><strong>{t("nog ~6 dagen", "~6 days left")}</strong></div>
          <div className="s1-days"><span>{t("Levertijd", "Lead time")}</span><div><i className="is-lead" style={{ width: "38%" }} /></div><strong>{t("10 dagen", "10 days")}</strong></div>
          <small>{t("Advies", "Advice")} <strong>{t("bestel 24 stuks", "order 24 units")}</strong></small></div>
        <div className="s1-arrow"><ArrowDown size={16} /> {t("Uitgerekend uit je eigen verkoop", "Calculated from your own sales")}</div>
        <Reply en={en} otis text={t("Het overhemd in M is eerder op dan je nieuwe levering binnen is. Bestel deze week bij.", "The shirt in M runs out before your next delivery arrives. Reorder this week.")} />
      </>;
    case "vragen":
      return <>
        <div className="h1-card"><Mail size={16} /><div><strong>{t("Uit je supportinbox · deze week", "From your support inbox · this week")}</strong><span>{t("“Is de witte sneaker in 41 weer binnen?”", "“Is the white sneaker back in size 41?”")}</span></div></div>
        <div className="s1-order"><div className="s1-order-top"><MessageSquare size={18} /><strong>{t("Sneaker wit · 41", "White sneaker · 41")}</strong><em>{t("Uitverkocht", "Sold out")}</em></div>
          <div className="s1-ask-row"><span>{t("Weer op voorraad?", "Back in stock?")}</span><strong>{t("5 klanten", "5 customers")}</strong></div>
          <div className="s1-ask-row"><span>{t("Pasvorm", "Fit")}</span><strong>{t("2 klanten", "2 customers")}</strong></div></div>
        <div className="s1-rule"><Mail size={17} /><span>{t("Wachtlijstmail voor 5 klanten", "Waitlist email for 5 customers")}</span><em>{t("Wacht op jou", "Needs you")}</em></div>
      </>;
    case "inkooporder":
      return <>
        <div className="h1-card"><MessageSquare size={16} /><div><strong>{t("Jij", "You")}</strong><span>{t("Wat moet ik deze week bijbestellen?", "What should I reorder this week?")}</span></div></div>
        <div className="s1-po"><div className="s1-order-top"><ClipboardList size={18} /><strong>{t("Concept-inkooporder", "Draft purchase order")}</strong><em>{t("Concept", "Draft")}</em></div>
          {[[t("Linnen overhemd · M", "Linen shirt · M"), "24"], [t("Linnen overhemd · L", "Linen shirt · L"), "12"], [t("Sneaker wit · 41", "White sneaker · 41"), "8"]].map(([name, units]) => <div className="s1-ask-row" key={name}><span>{name}</span><strong>{units} {t("st.", "pcs")}</strong></div>)}</div>
        <div className="s1-actions"><span>{t("Aanpassen", "Edit")}</span><span className="is-primary"><Check size={14} strokeWidth={3} /> {t("Bevestigen", "Confirm")}</span></div>
      </>;
    case "meldingen":
      return <>
        <div className="s1-rule"><AlertTriangle size={17} /><span>{t("Uitverkocht, 3 klanten vragen ernaar", "Sold out, 3 customers asking")}</span><em>{t("Nieuw", "New")}</em></div>
        <div className="s1-rule"><Truck size={17} /><span>{t("Levering 3 dagen te laat", "Delivery 3 days late")}</span><em>{t("Nieuw", "New")}</em></div>
        <div className="s1-rule"><CalendarClock size={17} /><span>{t("Zomercollectie: seizoen over 6 weken", "Summer collection: season in 6 weeks")}</span><em>{t("Vooruit", "Ahead")}</em></div>
        <div className="h1-ready"><Mail size={15} /> {t("Hoogstens één mail per dag", "At most one email a day")}</div>
      </>;
    default:
      return <div className="s1-chart">
        <strong>{t("Waar gaan de vragen over?", "What are the questions about?")}</strong><small>{t("Illustratieve verdeling", "Illustrative split")}</small>
        {[[t("Bezorging", "Delivery"), 82], [t("Retouren", "Returns"), 54], [t("Productinformatie", "Product info"), 33], [t("Overig", "Other"), 18]].map(([name, width], index) => (
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

export function SupportFeatureCards({ lang = "nl" }: { lang?: "nl" | "en" }) {
  const en = lang === "en";
  const AGENTS = en ? AGENTS_EN : AGENTS_NL;
  const tabsId = useId();
  const [agent, setAgent] = useState<AgentId>("seffy");
  const [open, setOpen] = useState<number | null>(null);
  const { features } = AGENTS[agent];
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
    setOpen((current) => current === null ? current : (current + delta + features.length) % features.length);
  }, [features.length]);

  // #otis of #seffy in de adresbalk (de links in het menu en bij de podia)
  // kiest de agent. Het scrollen doet de browser zelf, naar de ankers hieronder.
  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      if (id === "otis" || id === "seffy") setAgent(id);
    };
    const initial = window.setTimeout(fromHash, 0);
    window.addEventListener("hashchange", fromHash);
    return () => { window.clearTimeout(initial); window.removeEventListener("hashchange", fromHash); };
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

  const feature = open === null ? null : features[open];

  return (
    <div className={`s1-agent-cards s1-agent-cards--${agent}`}>
      <span id="seffy" className="s1-anchor" aria-hidden />
      <span id="otis" className="s1-anchor" aria-hidden />
      <div className="s1-cards-head">
        <div className="s1-heading s1-heading--mark">
          <SequenceMark key={agent} size={56} gear={AGENTS[agent].gear} state="reading" title="" />
          <span className="mk-section-kicker">{AGENTS[agent].kicker}</span>
          <h2>{AGENTS[agent].title}</h2>
          <p>{en ? "Click a card for more detail and an example." : "Klik op een kaart voor meer uitleg en een voorbeeld."}</p>
        </div>
        <div className="s1-switch" role="tablist" aria-label={en ? "Choose an agent" : "Kies een agent"}>
          {(Object.keys(AGENTS) as AgentId[]).map((id) => (
            <button key={id} type="button" role="tab" id={`${tabsId}-${id}`} aria-controls={`${tabsId}-panel`} tabIndex={agent === id ? 0 : -1} aria-selected={agent === id} onKeyDown={event => {
              const keys = Object.keys(AGENTS) as AgentId[];
              const index = keys.indexOf(id);
              const next = event.key === "Home" ? 0 : event.key === "End" ? keys.length - 1 : event.key === "ArrowRight" ? (index + 1) % keys.length : event.key === "ArrowLeft" ? (index + keys.length - 1) % keys.length : -1;
              if (next < 0) return;
              event.preventDefault(); setOpen(null); setAgent(keys[next]);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
            }} className={agent === id ? "is-active" : ""} onClick={() => { setOpen(null); setAgent(id); }}>
              <SequenceMark size={26} gear={AGENTS[id].gear} title="" /> {AGENTS[id].name}
            </button>
          ))}
        </div>
      </div>
      <div className={`s1-grid${features.length === 4 ? " s1-grid--four" : ""}`} key={agent} id={`${tabsId}-panel`} role="tabpanel" aria-labelledby={`${tabsId}-${agent}`}>
        {features.map((item, index) => {
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
                aria-label={`${item.title} ${en ? "More detail" : "Meer uitleg"}`}
                onClick={() => show(index)}
              />
              <div className="s1-card-top"><span className="s1-card-icon"><Icon size={19} /></span><span className="s1-card-kicker">0{index + 1} / {item.kicker}</span></div>
              <MiniVisual id={item.id} en={en} />
              <h3>{item.title}</h3>
              <p>{item.line}</p>
              <span className="s1-card-more">{en ? "More detail" : "Meer uitleg"} <span className="s1-plus"><Plus size={15} strokeWidth={2.6} /></span></span>
            </article>
          );
        })}
      </div>

      {feature && open !== null && (
        <div className="s1-modal">
          <div className="s1-backdrop" ref={backdropRef} onClick={close} aria-hidden />
          <div ref={panelRef} className={`s1-panel s1-panel--${agent}${feature.tone ? ` s1-panel--${feature.tone}` : ""}`} role="dialog" aria-modal="true" aria-labelledby="s1-dialog-title">
            <button type="button" ref={closeRef} className="s1-panel-close" onClick={close} aria-label={en ? "Close" : "Sluiten"}><X size={18} /></button>
            <div className="s1-panel-copy">
              <span className="s1-card-kicker" data-s1-in>0{open + 1} / {feature.kicker}</span>
              <h3 id="s1-dialog-title" data-s1-in>{feature.title}</h3>
              <p data-s1-in>{feature.body}</p>
              <ul data-s1-in>{feature.facts.map((fact) => <li key={fact}><Check size={15} strokeWidth={3} />{fact}</li>)}</ul>
              <div className="s1-panel-nav" data-s1-in>
                <button type="button" onClick={() => step(-1)} aria-label={en ? "Previous feature" : "Vorige functie"}><ArrowLeft size={16} /></button>
                <span>{open + 1} / {features.length}</span>
                <button type="button" onClick={() => step(1)} aria-label={en ? "Next feature" : "Volgende functie"}><ArrowRight size={16} /></button>
              </div>
            </div>
            <div className="s1-panel-visual" data-s1-in key={feature.id}><BigVisual id={feature.id} en={en} /></div>
          </div>
        </div>
      )}
    </div>
  );
}

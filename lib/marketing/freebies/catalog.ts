/**
 * Gratis downloads (lead magnets) op /nl/gratis en /en/free. Elke download
 * hoort bij een contentpijler en een vast Instagram-keyword: wie onder een
 * post het keyword comment, krijgt automatisch een DM met de link.
 *
 * Geen imports met een alias, zodat de tests dit bestand direct kunnen laden.
 */

export type FreebieId = "antwoord" | "retour" | "lek" | "regels" | "focus" | "delegeer" | "checkout";

export type Freebie = {
  id: FreebieId;
  /** Het woord dat mensen onder een post commenten. */
  keyword: string;
  /** Live staat op de site; soon toont alleen een kaart met "binnenkort". */
  live: boolean;
  nl: { path: string; title: string; description: string; format: string };
  en: { path: string; title: string; description: string; format: string };
};

export const FREEBIES: ReadonlyArray<Freebie> = [
  {
    id: "antwoord",
    keyword: "ANTWOORD",
    live: true,
    nl: {
      path: "/nl/gratis/antwoordenbank",
      title: "De Antwoordenbank",
      description: "30 kant-en-klare antwoorden op de klantvragen die je elke week krijgt. Van 'waar is mijn pakket' tot een boze klant.",
      format: "30 mails · kopiëren of als pdf",
    },
    en: {
      path: "/en/free/reply-bank",
      title: "The Reply Bank",
      description: "30 ready-to-send replies to the customer questions you get every week. From 'where is my parcel' to an angry customer.",
      format: "30 emails · copy or save as PDF",
    },
  },
  {
    id: "retour",
    keyword: "RETOUR",
    live: false,
    nl: { path: "/nl/gratis", title: "Draaiboek retourpiek januari", description: "Planning, mailtemplates en een checklist voor de drukste retourweken van het jaar.", format: "Draaiboek · binnenkort" },
    en: { path: "/en/free", title: "January returns playbook", description: "Planning, email templates and a checklist for the busiest returns weeks of the year.", format: "Playbook · coming soon" },
  },
  {
    id: "lek",
    keyword: "LEK",
    live: false,
    nl: { path: "/nl/gratis", title: "Margelek-calculator", description: "Vul je cijfers in en zie wat dozen, gratis verzending, betaalmethodes en retouren je per jaar kosten.", format: "Rekentool · binnenkort" },
    en: { path: "/en/free", title: "Margin leak calculator", description: "Enter your numbers and see what boxes, free shipping, payment methods and returns cost you each year.", format: "Calculator · coming soon" },
  },
  {
    id: "regels",
    keyword: "REGELS",
    live: false,
    nl: { path: "/nl/gratis", title: "Webshop-wetcheck", description: "De regels die nu voor je webshop gelden, op één A4.", format: "Checklist · binnenkort" },
    en: { path: "/en/free", title: "Online store law check", description: "The rules your online store has to follow right now, on one page.", format: "Checklist · coming soon" },
  },
  {
    id: "focus",
    keyword: "FOCUS",
    live: false,
    nl: { path: "/nl/gratis", title: "Weekplanner voor ondernemers", description: "Focusblokken, vergaderingen van 15 minuten en je jaarplan op één A4.", format: "Planner · binnenkort" },
    en: { path: "/en/free", title: "Weekly planner for founders", description: "Focus blocks, 15-minute meetings and your yearly plan on one page.", format: "Planner · coming soon" },
  },
  {
    id: "delegeer",
    keyword: "DELEGEER",
    live: false,
    nl: { path: "/nl/gratis", title: "Delegeer-scan", description: "Wat moet jij écht zelf doen? Plus een template om de rest over te dragen.", format: "Werkblad · binnenkort" },
    en: { path: "/en/free", title: "Delegation scan", description: "What do you really need to do yourself? Plus a template to hand off the rest.", format: "Worksheet · coming soon" },
  },
  {
    id: "checkout",
    keyword: "CHECKOUT",
    live: false,
    nl: { path: "/nl/gratis", title: "Checklist checkout en productpagina", description: "25 punten die bepalen of iemand afrekent, inclusief de mythes die je kunt overslaan.", format: "Checklist · binnenkort" },
    en: { path: "/en/free", title: "Checkout and product page checklist", description: "25 points that decide whether someone checks out, including the myths you can skip.", format: "Checklist · coming soon" },
  },
];

export function findFreebie(id: unknown): Freebie | undefined {
  return FREEBIES.find((item) => item.id === id);
}

export type LeadInput = {
  freebie: Freebie;
  email: string;
  name: string;
  store: string;
  /** Mag SequenceFlow ook tips mailen? Zonder vinkje alleen de download. */
  marketing: boolean;
  lang: "nl" | "en";
  source: string;
};

const clean = (value: unknown, max: number) => String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

/** Controleert wat het formulier stuurt. Geeft een foutmelding of de schone invoer. */
export function parseLead(body: Record<string, unknown>): { error: string } | { lead: LeadInput } {
  const lang = body.lang === "en" ? "en" : "nl";
  const freebie = findFreebie(body.freebie);
  if (!freebie || !freebie.live) return { error: lang === "en" ? "This download doesn't exist." : "Deze download bestaat niet." };
  const email = clean(body.email, 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: lang === "en" ? "Enter a valid email address." : "Vul een geldig e-mailadres in." };
  return {
    lead: {
      freebie,
      email,
      name: clean(body.name, 120),
      store: clean(body.store, 200),
      marketing: body.marketing === true,
      lang,
      // Bijvoorbeeld utm_source=instagram&utm_content=antwoord, voor wat werkt per post.
      source: clean(body.source, 300),
    },
  };
}

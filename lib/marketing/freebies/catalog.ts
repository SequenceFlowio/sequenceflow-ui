/**
 * Wat je op de Academy-pagina's (/nl/academy, /en/academy) met je e-mail
 * ophaalt: de wachtlijst voor de videocursussen en de bonusdownloads (zoals de
 * Antwoordenbank). Elk heeft een Instagram-keyword: wie onder een post het
 * keyword comment, krijgt automatisch een DM met de link.
 *
 * Geen imports met een alias, zodat de tests dit bestand direct kunnen laden.
 */

export type FreebieId = "academy" | "antwoord";

export type Freebie = {
  id: FreebieId;
  /** Het woord dat mensen onder een post commenten. */
  keyword: string;
  /** "waitlist" = aanmelden voor de Academy; "download" = meteen iets te openen. */
  kind: "waitlist" | "download";
  live: boolean;
  nl: { path: string; title: string; description: string; format: string };
  en: { path: string; title: string; description: string; format: string };
};

export const FREEBIES: ReadonlyArray<Freebie> = [
  {
    id: "academy",
    keyword: "COURSE",
    kind: "waitlist",
    live: true,
    nl: { path: "/nl/academy", title: "SequenceFlow Academy", description: "Korte videocursussen voor webshopondernemers.", format: "Videocursussen · binnenkort" },
    en: { path: "/en/academy", title: "SequenceFlow Academy", description: "Short video courses for online store owners.", format: "Video courses · coming soon" },
  },
  {
    id: "antwoord",
    keyword: "ANTWOORD",
    kind: "download",
    live: true,
    nl: {
      path: "/nl/academy/antwoordenbank",
      title: "De Antwoordenbank",
      description: "30 kant-en-klare antwoorden op de klantvragen die je elke week krijgt. Van 'waar is mijn pakket' tot een boze klant.",
      format: "30 mails · kopiëren of als pdf",
    },
    en: {
      path: "/en/academy/reply-bank",
      title: "The Reply Bank",
      description: "30 ready-to-send replies to the customer questions you get every week. From 'where is my parcel' to an angry customer.",
      format: "30 emails · copy or save as PDF",
    },
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

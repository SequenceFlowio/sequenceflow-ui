/**
 * Wat je op de Academy-pagina's (/nl/academy, /en/academy) met je e-mail
 * ophaalt: gratis toegang tot de uitlegvideo's. Elk heeft een
 * Instagram-keyword: wie onder een post het keyword comment, krijgt
 * automatisch een DM met de link. "download" is voor later (iets wat meteen
 * te openen is).
 *
 * Geen imports met een alias, zodat de tests dit bestand direct kunnen laden.
 */

export type FreebieId = "academy";

export type Freebie = {
  id: FreebieId;
  /** Het woord dat mensen onder een post commenten. */
  keyword: string;
  /** "access" = meteen toegang (de Academy-video's); "waitlist" = aanmelden voor later; "download" = iets te openen. */
  kind: "access" | "waitlist" | "download";
  live: boolean;
  nl: { path: string; title: string; description: string; format: string };
  en: { path: string; title: string; description: string; format: string };
};

export const FREEBIES: ReadonlyArray<Freebie> = [
  {
    id: "academy",
    keyword: "VIDEO",
    kind: "access",
    live: true,
    nl: { path: "/nl/academy", title: "SequenceFlow Academy", description: "Korte uitlegvideo's voor webshopondernemers.", format: "Uitlegvideo's · gratis" },
    en: { path: "/en/academy", title: "SequenceFlow Academy", description: "Short explainer videos for online store owners.", format: "Explainer videos · free" },
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

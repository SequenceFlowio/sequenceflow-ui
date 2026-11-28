import OpenAI from "openai";

import type { LeadSignals } from "./leadsCore.ts";

/**
 * Persoonlijke concepten per lead: een LinkedIn-bericht (Navaron verstuurt het zelf,
 * nooit een bot) en een mail (pas te versturen vanaf het aparte, opgewarmde domein).
 * Alleen gebaseerd op wat de eigen site van de shop openbaar laat zien.
 */

export const SALES_DRAFT_MODEL = process.env.SALES_DRAFT_MODEL || "gpt-4.1-mini";
export const LINKEDIN_MAX = 300;

export type LeadDraft = { linkedin: string; emailSubject: string; emailBody: string };

const SYSTEM = `Je schrijft korte, persoonlijke eerste berichten namens Navaron, oprichter van SequenceFlow uit Nederland.
Product: Support One, een AI-collega die in de bestaande supportmailbox van een webshop werkt. Het schrijft concepten op basis van het eigen beleid en de echte orderstatus (bol, Shopify, WooCommerce), de ondernemer keurt goed. Vanaf €49 per maand, 14 dagen gratis. Voor de eerste klanten richt Navaron het gratis zelf in.

Regels:
- Nederlands, je-vorm, nuchter. Geen hype, geen uitroeptekens, geen emoji, geen "Ik hoop dat het goed met je gaat".
- Open met één concreet ding over hun winkel of assortiment uit de feiten hieronder (wat ze verkopen, hoe groot het assortiment is, keurmerk/reviews, dat ze ook op bol verkopen). Begin met een hoofdletter.
- Noem nooit techniek: geen webshopplatform (Shopify, Magento ...), geen paginanamen, geen beveiliging of verificatie. Dat voelt als bespieden.
- Verzin niets: geen cijfers, namen, klachten of reviews die niet in de feiten staan. Noem bol alleen als de feiten zeggen dat ze op bol verkopen.
- Noem het probleem dat ze waarschijnlijk hebben (steeds dezelfde klantvragen over bezorging en retour, 's avonds nog mail) als vraag, niet als bewering.
- Eén lage drempel als vraag aan het eind: "Mag ik je laten zien hoe dat er met jullie eigen mail uitziet?" of iets vergelijkbaars. Geen link.
- Geen beloftes in procenten of uren. Woord "gecontroleerd" mag.
- LinkedIn: maximaal 300 tekens (limiet van een connectieverzoek), geen aanhef met naam (we kennen de naam niet), geen afsluiting.
- Mail: onderwerp max 6 woorden, kleine letters waar dat natuurlijk is. Body 60-110 woorden, aanhef "Hoi team van <shop>,", afsluiten met "Groet,\\nNavaron\\nSequenceFlow". Laatste regel apart: "Liever geen mail meer van mij? Antwoord met 'stop' en ik laat je met rust."

Antwoord alleen met JSON: {"linkedin": "...", "emailSubject": "...", "emailBody": "..."}`;

export function draftFacts(input: { name: string | null; domain: string; category: string | null; signals: LeadSignals }) {
  const s = input.signals;
  const facts = [
    `Shop: ${input.name || input.domain} (${input.domain})`,
    input.category ? `Categorie: ${input.category}` : null,
    s.title ? `Titel van de homepage: ${s.title}` : null,
    s.bol ? "Verkoopt ook op bol.com" : "Of ze op bol verkopen is onbekend: noem bol niet",
    s.platform !== "onbekend" ? `Webshopplatform: ${s.platform}` : null,
    s.productCount ? `Ongeveer ${s.productCount} producten` : null,
    s.trust.length ? `Keurmerken/reviews op de site: ${s.trust.join(", ")}` : null,
    s.reviewCount ? `Toont ${s.reviewCount} reviews` : null,
    s.helpdesk.length ? `Gebruikt al: ${s.helpdesk.join(", ")}` : "Geen helpdesk-tool gezien",
    s.hasFaq ? "Heeft een FAQ-pagina" : null,
    s.hasReturnsPage ? "Heeft een retourpagina" : null,
  ];
  return facts.filter(Boolean).join("\n");
}

/** Kort LinkedIn in tot de limiet, op een zinsgrens als dat kan. */
export function clampLinkedin(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= LINKEDIN_MAX) return clean;
  const cut = clean.slice(0, LINKEDIN_MAX);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "));
  return end > 120 ? cut.slice(0, end + 1) : `${cut.slice(0, LINKEDIN_MAX - 1).trimEnd()}…`;
}

export async function writeLeadDraft(input: { name: string | null; domain: string; category: string | null; signals: LeadSignals }, client?: OpenAI): Promise<LeadDraft> {
  const openai = client ?? new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await openai.chat.completions.create({
    model: SALES_DRAFT_MODEL,
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Feiten van de openbare site:\n${draftFacts(input)}` },
    ],
  });
  const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}") as Partial<LeadDraft>;
  if (!parsed.linkedin || !parsed.emailSubject || !parsed.emailBody) throw new Error("Concept onvolledig");
  return { linkedin: clampLinkedin(parsed.linkedin), emailSubject: parsed.emailSubject.trim(), emailBody: parsed.emailBody.trim() };
}

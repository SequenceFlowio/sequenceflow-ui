import type { Locale } from "./locale.ts";

/**
 * Slotoproep van elke post: de gratis SequenceFlow Academy. Wie "VIDEO" reageert, krijgt via de
 * Instagram-automatisering een DM met de link (NL en EN, allebei het keyword VIDEO).
 * Oude oproepen (link in bio, bewaren, delen, volgen, reageren) halen we eruit.
 */
export const ACADEMY_KEYWORD = "VIDEO";

export const ACADEMY_CTA: Record<Locale, string> = {
  nl: "Gratis korte uitlegvideo's voor je webshop? Comment VIDEO en je krijgt meteen toegang.",
  en: "Want free short explainer videos for your store? Comment VIDEO and get instant access.",
};

/** Gesproken versie voor het einde van een reel. */
export const ACADEMY_VOICE: Record<Locale, string> = {
  nl: "Comment video voor gratis uitlegvideo's voor je webshop.",
  en: "Comment video for free explainer videos for your store.",
};

/** Op de laatste carrouselslide. */
export const ACADEMY_SLIDE: Record<Locale, string> = {
  nl: "Comment VIDEO voor gratis uitlegvideo's voor je webshop.",
  en: "Comment VIDEO for free explainer videos for your store.",
};

const OLD_CTA = new RegExp([
  "link in (de |onze |our |the )?bio", "via de link", "link (staat|is) in", "in de comments", "in the comments", "laat (het )?weten", "let (us|me) know", "share in the comments",
  "\\bbewaar\\b", "\\bsla (deze|dit|hem|het)\\b.*\\bop\\b", "\\bsave this\\b", "stuur (hem |dit |het |deze )?door", "send (it|this) to", "share (it|this) with", "\\bdeel (hem|dit|deze|het)\\b",
  "\\bvolg @", "\\bvolg sequenceflow", "\\bfollow @", "\\bfollow sequenceflow", "14 dagen gratis", "veertien dagen gratis", "free for 14 days", "14 days free", "try it free", "probeer (het|support one)",
].join("|"), "i");

const sentencesOf = (text: string) => text.match(/[^.!?]+[.!?]+["”')]*\s*|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];

/** Caption met de Academy-oproep als slot; oude oproepen in de laatste alinea gaan eruit. */
export function withAcademyCta(caption: string, locale: Locale = "nl") {
  const text = caption.trim();
  // een eerdere (of vertaalde) Academy-oproep vervangen we door de vaste tekst
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p && !new RegExp(`\\bcomment ${ACADEMY_KEYWORD}\\b`, "i").test(p));
  const last = paragraphs.pop();
  if (last !== undefined) {
    // een vraag die alleen bij de oude oproep hoort ("Doe jij mee? Laat het weten in de comments.") gaat mee
    const keep = (line: string) => {
      const list = sentencesOf(line);
      return list.filter((s, i) => !OLD_CTA.test(s) && !(s.endsWith("?") && list[i + 1] && OLD_CTA.test(list[i + 1]))).join(" ");
    };
    const kept = last.split("\n").map(keep).filter(Boolean).join("\n");
    if (kept) paragraphs.push(kept);
  }
  return [...paragraphs, ACADEMY_CTA[locale]].join("\n\n");
}

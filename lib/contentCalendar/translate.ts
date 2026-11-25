import { CONTENT_TRANSLATE_MODEL_DEFAULT } from "@/lib/ai/models";
import { getOpenAIClient } from "@/lib/openaiClient";
import { BRAND, EN_HANDLE } from "./brand";
import { cleanDashes, englishId, translatable } from "./locale.ts";
import type { Post, Slide } from "./types";
import { cleanInvisible, shortenCaption } from "./copy.ts";

/**
 * Engelse versie van een Nederlandse carrousel, voor een Amerikaans publiek.
 * Geen letterlijke vertaling: bedragen in dollars, Amerikaanse voorbeelden, geen
 * Nederlandse instanties of regels. Posts die alleen in Nederland of de EU kloppen
 * (wetten, btw, iDEAL, Sinterklaas …) slaan we over in plaats van ze te verbouwen.
 * Reels en stories gaan nooit mee: die worden voor Engels opnieuw gemaakt.
 */
const MODEL = process.env.CONTENT_TRANSLATE_MODEL || CONTENT_TRANSLATE_MODEL_DEFAULT;

type Translation = { skip?: string; headline: string; subline: string; slides: Slide[]; caption: string; hashtags: string[] };

const SYSTEM = `You adapt Dutch Instagram carousels from ${BRAND.name} for its English account (${EN_HANDLE}), aimed at e-commerce founders in the United States (Shopify and WooCommerce stores, small teams).

Rules:
- Write natural, plain American English, as a native copywriter would. Keep the meaning, structure and number of slides. Short sentences, no hype, no emojis unless the original has one, no em dashes.
- Localize: euros become dollars with sensible US amounts (keep the math correct), Dutch carriers/marketplaces/payment methods become US equivalents (USPS, UPS, Amazon, credit cards, Shop Pay), Dutch holidays become US moments only when it still makes sense.
- Products: Support One is an AI teammate for e-commerce customer service (drafts replies in the store's tone with the order and policies attached; the founder approves; 14-day free trial). Content One is not available yet: never present it as usable. Only mention Shopify and WooCommerce as integrations.
- Caption: short, at most 300 characters. The first line (max 125 characters) is the hook or promise, no greeting, no emoji first. Then at most one or two short sentences and one call to action. No hashtags anywhere. If the Dutch caption mentions ${BRAND.handle}, use ${EN_HANDLE} instead.
- Avoid words that sound like AI: delve, crucial, seamless, unlock, elevate, leverage, game-changer, landscape, journey, robust, streamline.
- Return an empty hashtags array.
- If the post only makes sense in the Netherlands or the EU (Dutch or EU laws and regulators such as ACM, GPSR, the Omnibus directive, VAT/OSS, iDEAL/Wero, KvK, Sinterklaas, Dutch tax deadlines), do not translate it: return {"skip": "<short reason in Dutch>"}.

Return JSON only: {"headline": string, "subline": string, "slides": [{"title": string, "body": string}], "caption": string, "hashtags": string[]} or {"skip": string}.`;

export async function translateToEnglish(post: Post, feedback?: string, previous?: Pick<Post, "headline" | "slides" | "caption">): Promise<Translation> {
  const source = { format: post.format ?? "tips", headline: post.headline, subline: post.subline, slides: post.slides, caption: post.caption, hashtags: post.hashtags };
  const response = await getOpenAIClient().chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: JSON.stringify(source) },
      ...(feedback ? [{ role: "user" as const, content: `Previous English version: ${JSON.stringify(previous ?? {})}\nEditor feedback, apply it: ${feedback}` }] : []),
    ],
  });
  const data = JSON.parse(response.choices[0]?.message?.content || "{}") as Partial<Translation>;
  if (data.skip) return { skip: String(data.skip), headline: "", subline: "", slides: [], caption: "", hashtags: [] };
  const slides = Array.isArray(data.slides) ? data.slides.filter((s) => s?.title && s?.body).map((s) => ({ title: String(s.title), body: String(s.body) })) : [];
  if (!data.headline || slides.length !== post.slides.length) throw new Error("Vertaling onvolledig");
  return {
    headline: cleanDashes(String(data.headline)),
    subline: cleanDashes(String(data.subline ?? "")),
    slides: slides.map((sl) => ({ title: cleanDashes(sl.title), body: cleanDashes(sl.body) })),
    caption: shortenCaption(cleanInvisible(String(data.caption ?? "")).split("\n").map(cleanDashes).join("\n")),
    hashtags: [],
  };
}

/** Nieuwe Engelse post op dezelfde datum en tijd, maar dan New Yorkse tijd. Beeld wordt gedeeld. */
export function englishPost(post: Post, t: Translation): Post {
  const now = new Date().toISOString();
  return {
    ...post,
    id: englishId(post.id),
    locale: "en",
    sourceId: post.id,
    headline: t.headline,
    subline: t.subline,
    slides: t.slides,
    caption: t.caption,
    hashtags: t.hashtags,
    // beelden met interface-tekst zijn Nederlands en krijgen een Engelse versie
    needsEnglishImage: post.visual === "ui" ? true : undefined,
    image: { ...post.image, status: post.image.status === "generating" ? "none" : post.image.status, taskId: undefined },
    status: "review",
    feedback: undefined,
    publish: undefined,
    metrics: undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export { translatable };

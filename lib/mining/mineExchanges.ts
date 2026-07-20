import { getOpenAIClient } from "@/lib/openaiClient";
import type { HistoryMessage } from "@/lib/email/inbound/fetchMailboxHistory";

/**
 * Extract structured knowledge from a single historical sent reply. Webmail
 * replies almost always quote the customer's question underneath, so one Sent
 * message usually contains both sides of the exchange — the LLM splits them.
 */
export type MinedExchange = {
  isSupportReply: boolean;
  customerText: string | null;
  replyText: string | null;
  intent: string | null;
  quality: number | null; // 1..5
  facts: Array<{ text: string; kind: "fact" | "promise" | "house_rule" }>;
  toneNotes: string | null;
};

const EXTRACTION_SYSTEM = `You analyze a single email SENT BY a webshop's customer support team, mined from their Sent folder. The raw text usually contains the support reply at the top and the quoted customer message below.

Return strict JSON:
{
  "is_support_reply": boolean,       // false for newsletters, internal mail, order confirmations, automated mail
  "customer_text": string|null,      // the customer's question, extracted from the quoted part (null if absent)
  "reply_text": string|null,         // ONLY the support team's reply, quotes stripped
  "intent": string|null,             // one of: order_status, return_request, damaged_item, product_question, invoice, complaint, cancellation, other
  "quality": 1-5,                    // how useful this reply is as an example of GOOD support (5 = complete, correct, helpful)
  "facts": [{"text": string, "kind": "fact"|"promise"|"house_rule"}],
  "tone_notes": string|null          // 1 short sentence on tone/style markers (greeting, signoff, formality)
}

For "facts", extract concrete business knowledge asserted in the reply, e.g.:
- fact: "Retourtermijn is 30 dagen" / "Verzending via PostNL duurt 1-2 werkdagen"
- promise: "Bij beschadiging wordt gratis een vervangend product gestuurd"
- house_rule: "Korting wordt alleen aangeboden na een klacht over beschadiging"
Only include facts that are stated or clearly implied — never invent. Keep fact texts short and in the language of the email.`;

export async function extractExchange(message: HistoryMessage): Promise<MinedExchange | null> {
  const text = message.text.slice(0, 6000);
  if (text.length < 40) return null;

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 700,
    messages: [
      { role: "system", content: EXTRACTION_SYSTEM },
      { role: "user", content: `Subject: ${message.subject}\nDate: ${message.date ?? "?"}\n\n${text}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      is_support_reply?: boolean;
      customer_text?: string | null;
      reply_text?: string | null;
      intent?: string | null;
      quality?: number;
      facts?: Array<{ text?: string; kind?: string }>;
      tone_notes?: string | null;
    };
    return {
      isSupportReply: Boolean(parsed.is_support_reply),
      customerText: parsed.customer_text?.trim() || null,
      replyText: parsed.reply_text?.trim() || null,
      intent: parsed.intent?.trim() || null,
      quality: typeof parsed.quality === "number" ? Math.min(5, Math.max(1, Math.round(parsed.quality))) : null,
      facts: (parsed.facts ?? [])
        .filter((fact): fact is { text: string; kind: string } => Boolean(fact?.text))
        .map((fact) => ({
          text: fact.text.trim(),
          kind: fact.kind === "promise" || fact.kind === "house_rule" ? fact.kind : "fact",
        })),
      toneNotes: parsed.tone_notes?.trim() || null,
    };
  } catch {
    return null;
  }
}

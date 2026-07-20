import { getOpenAIClient } from "@/lib/openaiClient";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { createEmbedding } from "@/lib/embeddings";

/**
 * Second mining pass: aggregate all mined exchanges of a job into a single
 * distilled Agent Profile — identity, voice baseline, deduplicated house
 * rules and business facts (as `proposed` rows for white-glove review) and
 * top-quality exemplars per intent.
 */

type ExchangeRow = {
  id: string;
  intent: string | null;
  quality: number | null;
  customer_text: string | null;
  reply_text: string | null;
  subject: string | null;
  reply_message_id: string;
  replied_at: string | null;
  facts: Array<{ text: string; kind: string }> | null;
  tone_notes: string | null;
};

const DISTILL_SYSTEM = `You are building a knowledge profile for a webshop's AI support agent, from facts and tone notes mined from their real historical support replies.

Input: a list of raw fact lines (possibly duplicated/contradictory) and tone notes.

Return strict JSON:
{
  "identity": {
    "greeting": string,          // canonical greeting they use, e.g. "Hoi {naam}," or "Beste {naam},"
    "signoff": string,           // canonical signoff
    "pronoun": "je"|"u",         // dominant customer address form
    "company_descriptor": string // 1 sentence: what this business sells/does, inferred from the facts
  },
  "voice_notes": string,         // 2-3 sentences describing their voice; note anything to IMPROVE (too short, missing empathy) — the agent should write at a professional standard, not copy flaws
  "house_rules": [{"text": string, "confidence": 0..1}],  // deduplicated rules on what may/may not be said or promised
  "facts": [{"text": string, "confidence": 0..1}]         // deduplicated business facts (policies, shipping, warranty)
}

Deduplicate aggressively; when sources contradict, keep the most frequent/recent version and lower the confidence. Keep texts short, in the business's language. Max 25 house_rules, max 40 facts.`;

export async function distillProfile(input: { tenantId: string; jobId: string }) {
  const supabase = getSupabaseAdmin();

  const { data: exchanges, error } = await supabase
    .from("mined_exchanges")
    .select("id, intent, quality, customer_text, reply_text, subject, reply_message_id, replied_at, facts, tone_notes")
    .eq("job_id", input.jobId)
    .order("replied_at", { ascending: false })
    .limit(400);
  if (error) throw new Error(`distill: load exchanges failed: ${error.message}`);

  const rows = (exchanges ?? []) as ExchangeRow[];
  if (rows.length === 0) throw new Error("distill: no mined exchanges to distill");

  // Compact input for the aggregation call.
  const factLines: string[] = [];
  const toneLines: string[] = [];
  for (const row of rows) {
    for (const fact of row.facts ?? []) factLines.push(`[${fact.kind}] ${fact.text}`);
    if (row.tone_notes) toneLines.push(row.tone_notes);
  }

  const openai = getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: 3000,
    messages: [
      { role: "system", content: DISTILL_SYSTEM },
      {
        role: "user",
        content: `FACT LINES (${factLines.length}):\n${factLines.slice(0, 1200).join("\n")}\n\nTONE NOTES (${toneLines.length}):\n${toneLines.slice(0, 200).join("\n")}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("distill: empty aggregation response");
  const distilled = JSON.parse(raw) as {
    identity?: Record<string, unknown>;
    voice_notes?: string;
    house_rules?: Array<{ text?: string; confidence?: number }>;
    facts?: Array<{ text?: string; confidence?: number }>;
  };

  // Upsert the profile shell (draft — activation is an explicit human step).
  const { error: profileError } = await supabase.from("tenant_agent_profile").upsert(
    {
      tenant_id: input.tenantId,
      status: "draft",
      identity: distilled.identity ?? null,
      voice_notes: distilled.voice_notes ?? null,
      stats: { exchanges: rows.length, jobId: input.jobId, distilledAt: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );
  if (profileError) throw new Error(`distill: profile upsert failed: ${profileError.message}`);

  // Replace previous mining-originated proposals (keep approved/rejected and
  // learning/manual rows untouched) so a re-run doesn't stack duplicates.
  await supabase
    .from("tenant_profile_facts")
    .delete()
    .eq("tenant_id", input.tenantId)
    .eq("origin", "mining")
    .eq("status", "proposed");

  let inserted = 0;
  async function insertFact(row: {
    kind: string;
    content: string;
    confidence: number | null;
    intent?: string | null;
    sourceRefs?: unknown;
  }) {
    const embedding = await createEmbedding(row.content.slice(0, 2000));
    const { error: factError } = await supabase.from("tenant_profile_facts").insert({
      tenant_id: input.tenantId,
      kind: row.kind,
      intent: row.intent ?? null,
      content: row.content,
      confidence: row.confidence,
      source_refs: row.sourceRefs ?? null,
      status: "proposed",
      origin: "mining",
      embedding,
    });
    if (!factError) inserted += 1;
    else console.error("[distill] fact insert failed:", factError.message);
  }

  for (const rule of distilled.house_rules ?? []) {
    if (rule.text?.trim()) {
      await insertFact({ kind: "house_rule", content: rule.text.trim(), confidence: rule.confidence ?? null });
    }
  }
  for (const fact of distilled.facts ?? []) {
    if (fact.text?.trim()) {
      await insertFact({ kind: "fact", content: fact.text.trim(), confidence: fact.confidence ?? null });
    }
  }

  // Exemplars: best-quality complete exchanges, max 3 per intent.
  const byIntent = new Map<string, ExchangeRow[]>();
  for (const row of rows) {
    if (!row.intent || !row.customer_text || !row.reply_text || (row.quality ?? 0) < 4) continue;
    const list = byIntent.get(row.intent) ?? [];
    list.push(row);
    byIntent.set(row.intent, list);
  }
  for (const [intent, list] of byIntent) {
    const top = list.sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0)).slice(0, 3);
    for (const row of top) {
      await insertFact({
        kind: "exemplar",
        intent,
        content: `Q: ${row.customer_text!.slice(0, 800)}\nA: ${row.reply_text!.slice(0, 1200)}`,
        confidence: (row.quality ?? 4) / 5,
        sourceRefs: [{ messageId: row.reply_message_id, subject: row.subject, date: row.replied_at }],
      });
    }
  }

  return { exchanges: rows.length, factsInserted: inserted };
}

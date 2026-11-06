import { logAiCost, type AiUsageOperation } from "@/lib/ai/usage";
import { getOpenAIClient } from "@/lib/openaiClient";

/** `cost` legt de kosten vast voor ons overzicht (niet voor de klant). */
export async function createEmbedding(text: string, cost?: { tenantId: string | null | undefined; operation?: AiUsageOperation }) {
  const res = await getOpenAIClient().embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  void logAiCost({ tenantId: cost?.tenantId, operation: cost?.operation ?? "embedding", model: "text-embedding-3-small", usage: { prompt_tokens: res.usage?.prompt_tokens ?? 0, completion_tokens: 0 } });
  return res.data[0].embedding;
}

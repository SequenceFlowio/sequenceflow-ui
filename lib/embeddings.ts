import { getOpenAIClient } from "@/lib/openaiClient";

export async function createEmbedding(text: string) {
  const res = await getOpenAIClient().embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  return res.data[0].embedding;
}

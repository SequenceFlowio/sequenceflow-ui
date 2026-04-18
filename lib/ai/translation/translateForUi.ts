import crypto from "crypto";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOpenAIClient } from "@/lib/openaiClient";

type ContextType = "customer_message" | "draft" | "subject";

function extractJsonBlock(raw: string): unknown {
  const cleaned = raw.trim().replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No JSON found in translation response.");
  }
  const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(jsonStr);
  } catch {
    return JSON.parse(jsonStr.replace(/[\u0000-\u001F]/g, (c) =>
      c === "\n" ? "\\n" : c === "\r" ? "\\r" : c === "\t" ? "\\t" : ""
    ));
  }
}

export async function translateForUi(input: {
  tenantId: string;
  text: string;
  sourceLanguage?: string | null;
  targetLanguage?: "en";
  contextType: ContextType;
}): Promise<{
  sourceLanguage: string;
  translatedText: string;
  cacheHit: boolean;
}> {
  const text = input.text.trim();
  if (!text) {
    return {
      sourceLanguage: input.sourceLanguage ?? "unknown",
      translatedText: "",
      cacheHit: true,
    };
  }

  const targetLanguage = input.targetLanguage ?? "en";
  const contentHash = crypto
    .createHash("sha256")
    .update(`${input.contextType}:${input.sourceLanguage ?? "unknown"}:${targetLanguage}:${text}`)
    .digest("hex");

  const supabase = getSupabaseAdmin();
  const { data: cached } = await supabase
    .from("translation_cache")
    .select("translated_text, source_language")
    .eq("tenant_id", input.tenantId)
    .eq("content_hash", contentHash)
    .eq("target_language", targetLanguage)
    .eq("context_type", input.contextType)
    .maybeSingle();

  if (cached?.translated_text) {
    return {
      sourceLanguage: cached.source_language ?? input.sourceLanguage ?? "unknown",
      translatedText: cached.translated_text,
      cacheHit: true,
    };
  }

  const openai = getOpenAIClient();
  const maxTokens = input.contextType === "draft" ? 1500 : 600;
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content:
          "You are a translation engine for a customer support product. Detect the source language and translate the text into natural business English. Preserve meaning and customer support nuance. Return JSON only with keys sourceLanguage and translatedText.",
      },
      {
        role: "user",
        content: JSON.stringify({
          sourceLanguage: input.sourceLanguage ?? null,
          targetLanguage,
          contextType: input.contextType,
          text,
        }),
      },
    ],
    max_completion_tokens: maxTokens,
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  let sourceLanguage: string;
  let translatedText: string;
  try {
    const parsed = extractJsonBlock(raw);
    sourceLanguage = String(parsed.sourceLanguage ?? input.sourceLanguage ?? "unknown");
    translatedText = String(parsed.translatedText ?? text);
  } catch {
    sourceLanguage = input.sourceLanguage ?? "unknown";
    translatedText = text;
  }

  await supabase.from("translation_cache").upsert(
    {
      tenant_id: input.tenantId,
      content_hash: contentHash,
      source_language: sourceLanguage,
      target_language: targetLanguage,
      context_type: input.contextType,
      original_text: text,
      translated_text: translatedText,
      model: "gpt-4.1-mini",
    },
    {
      onConflict: "tenant_id,content_hash,target_language,context_type",
    }
  );

  return {
    sourceLanguage,
    translatedText,
    cacheHit: false,
  };
}

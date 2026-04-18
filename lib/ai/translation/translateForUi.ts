import crypto from "crypto";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getOpenAIClient } from "@/lib/openaiClient";

type ContextType = "customer_message" | "draft" | "subject";

function extractJsonBlock(raw: string): Record<string, unknown> {
  const cleaned = raw.trim().replace(/```json/gi, "").replace(/```/g, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No JSON found in translation response.");
  }

  const jsonSlice = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    return JSON.parse(jsonSlice) as Record<string, unknown>;
  } catch {
    return JSON.parse(
      jsonSlice.replace(/[\u0000-\u001F]/g, (char) =>
        char === "\n" ? "\\n" : char === "\r" ? "\\r" : char === "\t" ? "\\t" : ""
      )
    ) as Record<string, unknown>;
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

  try {
    const openai = getOpenAIClient();
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
      max_completion_tokens: input.contextType === "draft" ? 1500 : 600,
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = extractJsonBlock(raw);
    const sourceLanguage = String(parsed.sourceLanguage ?? input.sourceLanguage ?? "unknown");
    const translatedText = String(parsed.translatedText ?? text);

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
  } catch (error) {
    console.error("[translateForUi]", error);

    return {
      sourceLanguage: input.sourceLanguage ?? "unknown",
      translatedText: text,
      cacheHit: false,
    };
  }
}

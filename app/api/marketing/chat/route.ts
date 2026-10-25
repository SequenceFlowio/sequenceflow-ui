import { NextRequest, NextResponse } from "next/server";

import { CHAT_LIMITS, SITE_CHAT_PROMPT } from "@/lib/marketing/siteChat";
import { getOpenAIClient } from "@/lib/openaiClient";

export const runtime = "nodejs";

/**
 * Chat op de website: openbaar, dus een vaste kennisbank in de systeemprompt,
 * een harde limiet op lengte en aantal berichten, en een eenvoudige limiet
 * per IP (best effort per instance, net als het kennismakingsformulier).
 */

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 40;
const recent = new Map<string, number[]>();

function limited(ip: string) {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  return hits.length > MAX_PER_WINDOW;
}

const FALLBACK = "Dat lukt me nu even niet. Mail ons gerust via hallo@sequenceflow.io, dan helpt een collega je verder.";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { messages?: unknown } | null;
  const raw = Array.isArray(body?.messages) ? body.messages : null;
  if (!raw?.length) return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (limited(ip)) {
    return NextResponse.json({ reply: "Je stelt veel vragen achter elkaar. Mail ons gerust direct via hallo@sequenceflow.io." }, { status: 429 });
  }

  const messages = raw
    .slice(-CHAT_LIMITS.messages)
    .map((item) => item as { role?: unknown; text?: unknown })
    .filter((item) => (item.role === "user" || item.role === "bot") && typeof item.text === "string" && item.text.trim())
    .map((item) => ({
      role: item.role === "user" ? ("user" as const) : ("assistant" as const),
      content: String(item.text).slice(0, CHAT_LIMITS.messageChars),
    }));
  if (messages.at(-1)?.role !== "user") return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });

  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "system", content: SITE_CHAT_PROMPT }, ...messages],
      max_completion_tokens: 350,
      temperature: 0.4,
    });
    const reply = completion.choices[0]?.message?.content?.trim();
    return NextResponse.json({ reply: reply || FALLBACK });
  } catch (error) {
    console.error("[marketing/chat]", error);
    return NextResponse.json({ reply: FALLBACK }, { status: 502 });
  }
}

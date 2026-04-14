import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getTenantId } from "@/lib/tenant";
import OpenAI from "openai";

export const runtime = "nodejs";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  nl: "Dutch",
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let tenantId: string;
  try {
    ({ tenantId } = await getTenantId(req));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.message === "Not authenticated" ? 401 : 403 });
  }

  const { language } = await req.json();
  if (!language || !LANGUAGE_NAMES[language]) {
    return NextResponse.json({ error: "Invalid language" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: ticket, error } = await supabase
    .from("tickets")
    .select("id, tenant_id, body_text, ai_draft, subject")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const customerText = ticket.body_text ?? "";
  const aiDraft = ticket.ai_draft as { body?: string } | string | null;
  const draftText = typeof aiDraft === "string" ? aiDraft : (aiDraft?.body ?? "");
  const langName = LANGUAGE_NAMES[language];

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `Translate the following two texts to ${langName}. Return a JSON object with keys "customer" and "draft". Keep formatting (line breaks, paragraphs). Do not add explanations.

CUSTOMER MESSAGE:
${customerText}

DRAFT REPLY:
${draftText}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });

  let translated: { customer: string; draft: string };
  try {
    translated = JSON.parse(completion.choices[0].message.content ?? "{}");
  } catch {
    return NextResponse.json({ error: "Translation parsing failed" }, { status: 500 });
  }

  return NextResponse.json({
    customer: translated.customer ?? customerText,
    draft: translated.draft ?? draftText,
  });
}
